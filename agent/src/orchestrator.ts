import { formatEther, parseEther } from "viem";
import { publicClient } from "./client.js";
import { config } from "./config.js";
import { JOB_MARKETPLACE_ABI } from "./abi.js";
import { costTracker } from "./cost-tracker.js";
import { decomposeJob } from "./decomposer.js";
import { verifyProof } from "./verifier.js";
import { readJobFromContract, readTaskFromContract } from "./contract-reads.js";
import { addTaskOnChain, approveTaskOnChain, completeJobOnChain, rejectProofOnChain } from "./actions/marketplace.js";
import { ethToUsd } from "./price-feed.js";
import { EventEmitter } from "events";
import { type AgentAction, type AgentTransaction } from "./types.js";

export class JobOrchestrator extends EventEmitter {
  private jobTaskCounts = new Map<bigint, number>();
  private recentActions: AgentAction[] = [];
  private recentTransactions: AgentTransaction[] = [];

  setJobTaskCount(jobId: bigint, count: number) {
    this.jobTaskCounts.set(jobId, count);
  }

  getRecentActions() { return this.recentActions; }
  getRecentTransactions() { return this.recentTransactions; }

  override emit(event: string | symbol, ...args: any[]): boolean {
    if (event === "action" && args[0]) {
      this.recentActions = [args[0], ...this.recentActions].slice(0, 200);
    }
    if (event === "transaction" && args[0]) {
      this.recentTransactions = [args[0], ...this.recentTransactions].slice(0, 200);
    }
    return super.emit(event, ...args);
  }

  emitMetrics() {
    super.emit("metrics", costTracker.getMetricsSnapshot());
  }

  startListening() {
    const contractArgs = {
      address: config.contractAddress,
      abi: JOB_MARKETPLACE_ABI,
    } as const;

    publicClient.watchContractEvent({
      ...contractArgs,
      eventName: "JobCreated",
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.onJobCreated(log.args.jobId!, log.args.description!, log.args.budget!);
        }
      },
    });

    publicClient.watchContractEvent({
      ...contractArgs,
      eventName: "ProofSubmitted",
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.onProofSubmitted(log.args.jobId!, log.args.taskId!, log.args.proofURI!);
        }
      },
    });

    publicClient.watchContractEvent({
      ...contractArgs,
      eventName: "TaskAccepted",
      onLogs: (logs) => {
        for (const log of logs) {
          this.emit("action", {
            type: "task_accepted",
            jobId: log.args.jobId!.toString(),
            taskId: log.args.taskId!.toString(),
            worker: log.args.worker,
            timestamp: Date.now(),
          });
          this.emitMetrics();
        }
      },
    });

    publicClient.watchContractEvent({
      ...contractArgs,
      eventName: "TaskExpired",
      onLogs: (logs) => {
        for (const log of logs) {
          this.emit("action", {
            type: "task_expired",
            jobId: log.args.jobId!.toString(),
            taskId: log.args.taskId!.toString(),
            previousWorker: log.args.previousWorker,
            timestamp: Date.now(),
          });
        }
      },
    });

    publicClient.watchContractEvent({
      ...contractArgs,
      eventName: "JobCancelled",
      onLogs: (logs) => {
        for (const log of logs) {
          this.emit("action", {
            type: "job_cancelled",
            jobId: log.args.jobId!.toString(),
            refund: log.args.refund!.toString(),
            timestamp: Date.now(),
          });
          this.emitMetrics();
        }
      },
    });

    console.log("Orchestrator listening for on-chain events...");
  }

  async onJobCreated(jobId: bigint, description: string, budget: bigint) {
    try {
      this.emit("action", { type: "job_received", jobId: jobId.toString(),
        description, budget: formatEther(budget), timestamp: Date.now() });

      const taskPlan = await decomposeJob(description, budget);
      costTracker.logCost({ type: "openai", amount_usd: 0.02, details: "decompose-job" });

      const totalWorkerCost = taskPlan.reduce(
        (sum, t) => sum + parseEther(t.reward), 0n
      );
      if (taskPlan.length === 0 || totalWorkerCost >= budget) {
        console.error(`Bad decomposition: ${taskPlan.length} tasks, cost ${totalWorkerCost} >= budget ${budget}`);
        return;
      }

      const margin = formatEther(budget - totalWorkerCost);
      this.emit("action", { type: "job_decomposed", jobId: jobId.toString(),
        taskCount: taskPlan.length, margin, timestamp: Date.now() });

      for (let i = 0; i < taskPlan.length; i++) {
        const task = taskPlan[i];
        const txHash = await addTaskOnChain(jobId, {
          description: task.description,
          proofRequirements: task.proofRequirements,
          reward: parseEther(task.reward),
          deadlineSeconds: BigInt(task.deadlineMinutes * 60),
          maxRetries: 3n,
        }, i);
        costTracker.logCost({ type: "gas", amount_usd: 0.001, details: `addTask-${i}` });
        this.emit("action", { type: "task_posted", jobId: jobId.toString(),
          description: task.description, reward: task.reward, timestamp: Date.now() });
        this.emit("transaction", { action: "Add task", hash: txHash, timestamp: Date.now() });
      }
      this.jobTaskCounts.set(jobId, taskPlan.length);
      this.emitMetrics();
    } catch (err) {
      console.error(`Error handling JobCreated ${jobId}:`, err);
    }
  }

  async onProofSubmitted(jobId: bigint, taskId: bigint, proofURI: string) {
    try {
      this.emit("action", { type: "proof_submitted", jobId: jobId.toString(),
        taskId: taskId.toString(), timestamp: Date.now() });

      const task = await readTaskFromContract(taskId);
      const job = await readJobFromContract(jobId);
      const result = await verifyProof(task, proofURI);
      costTracker.logCost({ type: "openai", amount_usd: 0.05, details: `verify-task-${taskId}` });

      if (result.approved) {
        const approveTxHash = await approveTaskOnChain(jobId, taskId);
        costTracker.logCost({ type: "gas", amount_usd: 0.001, details: `approveTask-${taskId}` });

        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

        this.emit("action", { type: "proof_verified", jobId: jobId.toString(),
          taskId: taskId.toString(), confidence: result.confidence,
          scores: result.scores, timestamp: Date.now() });
        this.emit("action", { type: "worker_paid", jobId: jobId.toString(),
          taskId: taskId.toString(), worker: task.worker,
          amount: formatEther(task.reward), timestamp: Date.now() });
        this.emit("transaction", { action: "Approve task + pay worker",
          hash: approveTxHash, amount: formatEther(task.reward), timestamp: Date.now() });

        const totalTasks = this.jobTaskCounts.get(jobId) ?? 0;
        const isLastTask = Number(task.sequenceIndex) === totalTasks - 1;

        if (!isLastTask) {
          this.emit("action", { type: "next_task_opened", jobId: jobId.toString(),
            timestamp: Date.now() });
        }

        if (isLastTask) {
          const completeTxHash = await completeJobOnChain(jobId);
          costTracker.logCost({ type: "gas", amount_usd: 0.001, details: `completeJob-${jobId}` });

          await publicClient.waitForTransactionReceipt({ hash: completeTxHash });

          const profit = job.totalBudget - job.totalSpent - task.reward;
          const profitUsd = await ethToUsd(profit);
          costTracker.logRevenue({ type: "job_profit", amount_usd: profitUsd });

          this.emit("action", { type: "job_completed", jobId: jobId.toString(),
            profit: formatEther(profit), profitUsd, timestamp: Date.now() });
          this.emit("transaction", { action: "Complete job + withdraw profit",
            hash: completeTxHash, amount: formatEther(profit), timestamp: Date.now() });
        }

        this.emitMetrics();
      } else {
        const rejectTxHash = await rejectProofOnChain(jobId, taskId, result.suggestion);
        costTracker.logCost({ type: "gas", amount_usd: 0.001, details: `rejectProof-${taskId}` });

        this.emit("action", { type: "proof_rejected", jobId: jobId.toString(),
          taskId: taskId.toString(), reason: result.suggestion, timestamp: Date.now() });
        this.emit("transaction", { action: "Reject proof",
          hash: rejectTxHash, timestamp: Date.now() });
        this.emitMetrics();
      }
    } catch (err) {
      console.error(`Error handling ProofSubmitted ${jobId}/${taskId}:`, err);
    }
  }
}
