import { formatEther, parseEther } from 'viem';
import { publicClient } from './client.js';
import { config } from './config.js';
import { JOB_MARKETPLACE_ABI } from './abi.js';
import { costTracker } from './cost-tracker.js';
import { decomposeJob } from './decomposer.js';
import { verifyProof } from './verifier.js';
import { executeAiTask } from './ai-executor.js';
import { type AiTaskResult } from './types.js';
import { readJobFromContract, readTaskFromContract } from './contract-reads.js';
import {
  addTaskOnChain,
  approveTaskOnChain,
  completeJobOnChain,
  rejectProofOnChain,
} from './actions/marketplace.js';
import { ethToUsd } from './price-feed.js';
import { EventEmitter } from 'events';
import { type AgentAction, type AgentTransaction } from './types.js';
import {
  setTaskTags,
  updateWorkerReputation,
  getWorkerReputation,
  calculateBonus,
  recordVerification,
  addBonusToReputation,
  getReputationTier,
  insertAgentAction,
  insertAgentTransaction,
  getRecentAgentActions,
  getRecentAgentTransactions,
} from './supabase.js';
import { type AgentWallet } from './wallet.js';
import { postJobCreatedTweet } from './twitter.js';

export class JobOrchestrator extends EventEmitter {
  private jobTaskCounts = new Map<bigint, number>();
  private recentActions: AgentAction[] = [];
  private recentTransactions: AgentTransaction[] = [];
  private wallet: AgentWallet | null = null;

  setWallet(w: AgentWallet) {
    this.wallet = w;
  }

  async initialize() {
    try {
      this.recentActions = await getRecentAgentActions(200);
      this.recentTransactions = await getRecentAgentTransactions(200);
      console.log(
        `Loaded ${this.recentActions.length} actions, ${this.recentTransactions.length} transactions from Supabase`,
      );
    } catch (err) {
      console.warn('Could not load agent history from Supabase:', err);
    }
  }

  setJobTaskCount(jobId: bigint, count: number) {
    this.jobTaskCounts.set(jobId, count);
  }

  getRecentActions() {
    return this.recentActions;
  }
  getRecentTransactions() {
    return this.recentTransactions;
  }

  override emit(event: string | symbol, ...args: any[]): boolean {
    if (event === 'action' && args[0]) {
      this.recentActions = [args[0], ...this.recentActions].slice(0, 200);
      insertAgentAction(args[0]).catch((e) =>
        console.error('Failed to persist action:', e),
      );
    }
    if (event === 'transaction' && args[0]) {
      this.recentTransactions = [args[0], ...this.recentTransactions].slice(
        0,
        200,
      );
      insertAgentTransaction(args[0]).catch((e) =>
        console.error('Failed to persist transaction:', e),
      );
    }
    return super.emit(event, ...args);
  }

  emitMetrics() {
    super.emit('metrics', costTracker.getMetricsSnapshot());
  }

  private lastPolledBlock = 0n;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  startListening() {
    this.startEventPolling();
    console.log(
      'Orchestrator listening for on-chain events (polling every 3s)...',
    );
  }

  stopListening() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async startEventPolling() {
    try {
      this.lastPolledBlock = await publicClient.getBlockNumber();
    } catch {
      this.lastPolledBlock = 0n;
    }

    await this.pollEvents();

    this.pollTimer = setInterval(() => {
      this.pollEvents().catch((err) =>
        console.error('[poller] Poll cycle error:', err),
      );
    }, 3_000);
  }

  private async pollEvents() {
    if (this.polling) return;
    this.polling = true;

    try {
      const latestBlock = await publicClient.getBlockNumber();
      if (latestBlock <= this.lastPolledBlock) {
        this.polling = false;
        return;
      }

      const fromBlock = this.lastPolledBlock + 1n;
      const events = await publicClient.getContractEvents({
        address: config.contractAddress,
        abi: JOB_MARKETPLACE_ABI,
        fromBlock,
        toBlock: latestBlock,
      });

      this.lastPolledBlock = latestBlock;

      for (const event of events) {
        const args = event.args as any;
        switch (event.eventName) {
          case 'JobCreated':
            console.log(
              `[poller] JobCreated #${args.jobId} at block ${event.blockNumber}`,
            );
            await this.onJobCreated(
              args.jobId!,
              args.description!,
              args.budget!,
            );
            break;

          case 'ProofSubmitted':
            console.log(
              `[poller] ProofSubmitted job=${args.jobId} task=${args.taskId} at block ${event.blockNumber}`,
            );
            await this.onProofSubmitted(
              args.jobId!,
              args.taskId!,
              args.proofURI!,
            );
            break;

          case 'TaskAccepted':
            console.log(
              `[poller] TaskAccepted job=${args.jobId} task=${args.taskId}`,
            );
            this.emit('action', {
              type: 'task_accepted',
              jobId: args.jobId!.toString(),
              taskId: args.taskId!.toString(),
              worker: args.worker,
              timestamp: Date.now(),
            });
            this.emitMetrics();
            break;

          case 'TaskExpired':
            console.log(
              `[poller] TaskExpired job=${args.jobId} task=${args.taskId}`,
            );
            this.emit('action', {
              type: 'task_expired',
              jobId: args.jobId!.toString(),
              taskId: args.taskId!.toString(),
              previousWorker: args.previousWorker,
              timestamp: Date.now(),
            });
            break;

          case 'JobCancelled':
            console.log(`[poller] JobCancelled job=${args.jobId}`);
            this.emit('action', {
              type: 'job_cancelled',
              jobId: args.jobId!.toString(),
              refund: args.refund!.toString(),
              timestamp: Date.now(),
            });
            this.emitMetrics();
            break;
        }
      }
    } catch (err) {
      console.error('[poller] Failed to fetch events:', err);
    } finally {
      this.polling = false;
    }
  }

  async onJobCreated(jobId: bigint, description: string, budget: bigint) {
    try {
      console.log('onJobCreated Called');
      this.emit('action', {
        type: 'job_received',
        jobId: jobId.toString(),
        description,
        budget: formatEther(budget),
        timestamp: Date.now(),
      });

      // Post job to Twitter (non-blocking; skip if Twitter env not set)
      postJobCreatedTweet(jobId.toString(), description, formatEther(budget)).catch((err) =>
        console.error('[twitter] Job tweet failed:', err),
      );

      const taskPlan = await decomposeJob(description, budget);
      costTracker.logCost({
        type: 'openai',
        amount_usd: 0.02,
        details: 'decompose-job',
      });

      const humanTasks = taskPlan.filter((t) => t.executorType === 'human');
      const totalWorkerCost = humanTasks.reduce(
        (sum, t) => sum + parseEther(t.reward),
        0n,
      );
      if (taskPlan.length === 0) {
        console.error(`Empty decomposition for job ${jobId}`);
        return;
      }
      if (humanTasks.length > 0 && totalWorkerCost >= budget) {
        console.error(
          `Bad decomposition: cost ${totalWorkerCost} >= budget ${budget}`,
        );
        return;
      }

      const margin = formatEther(budget - totalWorkerCost);
      this.emit('action', {
        type: 'job_decomposed',
        jobId: jobId.toString(),
        taskCount: taskPlan.length,
        aiTaskCount: taskPlan.filter((t) => t.executorType === 'ai').length,
        humanTaskCount: humanTasks.length,
        margin,
        timestamp: Date.now(),
      });

      // Phase 1: Execute AI tasks sequentially (they may depend on each other)
      const aiResults: AiTaskResult[] = [];
      for (let i = 0; i < taskPlan.length; i++) {
        const task = taskPlan[i];
        if (task.executorType !== 'ai') continue;

        this.emit('action', {
          type: 'ai_task_started',
          jobId: jobId.toString(),
          description: task.description,
          sequenceIndex: i,
          timestamp: Date.now(),
        });

        const result = await executeAiTask(
          jobId.toString(),
          i,
          task.description,
          aiResults,
        );
        costTracker.logCost({
          type: 'openai',
          amount_usd: 0.02,
          details: `ai-task-${i}`,
        });
        aiResults.push(result);

        this.emit('action', {
          type: 'ai_task_completed',
          jobId: jobId.toString(),
          description: task.description,
          sequenceIndex: i,
          status: result.status,
          timestamp: Date.now(),
        });
      }

      // Build per-AI-task key facts map for targeted injection
      const aiFactsByIndex = new Map<number, string[]>();
      const allKeyFacts: string[] = [];
      for (const result of aiResults) {
        if (result.status === 'completed' && result.key_facts.length > 0) {
          aiFactsByIndex.set(result.sequence_index, result.key_facts);
          allKeyFacts.push(...result.key_facts);
        }
      }

      // Phase 2: Post human tasks on-chain with AI findings injected
      if (humanTasks.length > 0) {
        const nextId = (await publicClient.readContract({
          address: config.contractAddress,
          abi: JOB_MARKETPLACE_ABI,
          functionName: 'nextTaskId',
        })) as bigint;

        let humanIndex = 0;
        for (let i = 0; i < taskPlan.length; i++) {
          const task = taskPlan[i];
          if (task.executorType !== 'human') continue;

          // Only inject AI findings relevant to this specific human task
          let relevantFacts: string[] = [];
          if (task.relevantAiTasks && task.relevantAiTasks.length > 0) {
            for (const aiIdx of task.relevantAiTasks) {
              const facts = aiFactsByIndex.get(aiIdx);
              if (facts) relevantFacts.push(...facts);
            }
          } else {
            relevantFacts = allKeyFacts;
          }
          relevantFacts = relevantFacts.slice(0, 4);

          let enrichedDescription = task.description;
          if (relevantFacts.length > 0) {
            const aiContext = relevantFacts.map((f) => `- ${f}`).join('\n');
            enrichedDescription = `${task.description}\n\nNotes:\n${aiContext}`;
          }

          const txHash = await addTaskOnChain(
            jobId,
            {
              description: enrichedDescription,
              proofRequirements: task.proofRequirements,
              reward: parseEther(task.reward),
              deadlineSeconds: BigInt(task.deadlineMinutes * 60),
              maxRetries: 3n,
            },
            humanIndex,
          );
          costTracker.logCost({
            type: 'gas',
            amount_usd: 0.001,
            details: `addTask-${humanIndex}`,
          });

          const taskId = (nextId + BigInt(humanIndex)).toString();
          if (task.tags && task.tags.length > 0) {
            setTaskTags(taskId, task.tags, jobId.toString()).catch((err) =>
              console.error(`Failed to store tags for task ${taskId}:`, err),
            );
          }

          this.emit('action', {
            type: 'task_posted',
            jobId: jobId.toString(),
            description: task.description,
            reward: task.reward,
            timestamp: Date.now(),
          });
          this.emit('transaction', {
            action: 'Add task',
            hash: txHash,
            timestamp: Date.now(),
          });
          humanIndex++;
        }
        this.jobTaskCounts.set(jobId, humanIndex);
      } else {
        // All tasks were AI-only — complete the job immediately
        const completeTxHash = await completeJobOnChain(jobId);
        costTracker.logCost({
          type: 'gas',
          amount_usd: 0.001,
          details: `completeJob-${jobId}`,
        });
        const profitUsd = await ethToUsd(budget);
        costTracker.logRevenue({ type: 'job_profit', amount_usd: profitUsd });
        this.emit('action', {
          type: 'job_completed',
          jobId: jobId.toString(),
          profit: formatEther(budget),
          profitUsd,
          timestamp: Date.now(),
        });
        this.emit('transaction', {
          action: 'Complete job (AI-only)',
          hash: completeTxHash,
          amount: formatEther(budget),
          timestamp: Date.now(),
        });
      }

      this.emitMetrics();
    } catch (err) {
      console.error(`Error handling JobCreated ${jobId}:`, err);
    }
  }

  async onProofSubmitted(jobId: bigint, taskId: bigint, proofURI: string) {
    try {
      this.emit('action', {
        type: 'proof_submitted',
        jobId: jobId.toString(),
        taskId: taskId.toString(),
        timestamp: Date.now(),
      });

      const task = await readTaskFromContract(taskId);
      const job = await readJobFromContract(jobId);
      const result = await verifyProof(task, proofURI);
      costTracker.logCost({
        type: 'openai',
        amount_usd: 0.05,
        details: `verify-task-${taskId}`,
      });

      if (result.approved) {
        const approveTxHash = await approveTaskOnChain(jobId, taskId);
        costTracker.logCost({
          type: 'gas',
          amount_usd: 0.001,
          details: `approveTask-${taskId}`,
        });

        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

        this.emit('action', {
          type: 'proof_verified',
          jobId: jobId.toString(),
          taskId: taskId.toString(),
          confidence: result.confidence,
          scores: result.scores,
          timestamp: Date.now(),
        });
        this.emit('action', {
          type: 'worker_paid',
          jobId: jobId.toString(),
          taskId: taskId.toString(),
          worker: task.worker,
          amount: formatEther(task.reward),
          timestamp: Date.now(),
        });
        this.emit('transaction', {
          action: 'Approve task + pay worker',
          hash: approveTxHash,
          amount: formatEther(task.reward),
          timestamp: Date.now(),
        });

        // ── Reputation + Bonus ──
        let bonusWei = 0n;
        try {
          await updateWorkerReputation(task.worker, true, result.scores);
          const rep = await getWorkerReputation(task.worker);
          if (rep) {
            bonusWei = calculateBonus(
              rep.reputation_score,
              rep.tasks_completed,
              task.reward,
            );
            if (bonusWei > 0n && this.wallet) {
              const bonusTxHash = await this.wallet.sendTransaction({
                to: task.worker as `0x${string}`,
                value: bonusWei,
              });
              const bonusUsd = await ethToUsd(bonusWei);
              costTracker.logCost({
                type: 'gas',
                amount_usd: bonusUsd,
                details: `reputation-bonus-${taskId}`,
              });
              await addBonusToReputation(task.worker, bonusWei.toString());
              const tier = getReputationTier(
                rep.reputation_score,
                rep.tasks_completed,
              );
              this.emit('action', {
                type: 'bonus_paid',
                jobId: jobId.toString(),
                taskId: taskId.toString(),
                worker: task.worker,
                bonusAmount: formatEther(bonusWei),
                tier,
                reputationScore: rep.reputation_score,
                timestamp: Date.now(),
              });
              this.emit('transaction', {
                action: 'Reputation bonus',
                hash: bonusTxHash,
                amount: formatEther(bonusWei),
                timestamp: Date.now(),
              });
            }
          }
          await recordVerification(
            task.worker,
            taskId.toString(),
            jobId.toString(),
            true,
            result.confidence,
            result.scores,
            bonusWei.toString(),
          );
        } catch (err) {
          console.error(`Reputation/bonus error for task ${taskId}:`, err);
        }

        const totalTasks = this.jobTaskCounts.get(jobId) ?? 0;
        const isLastTask = Number(task.sequenceIndex) === totalTasks - 1;

        if (!isLastTask) {
          this.emit('action', {
            type: 'next_task_opened',
            jobId: jobId.toString(),
            timestamp: Date.now(),
          });
        }

        if (isLastTask) {
          const completeTxHash = await completeJobOnChain(jobId);
          costTracker.logCost({
            type: 'gas',
            amount_usd: 0.001,
            details: `completeJob-${jobId}`,
          });

          await publicClient.waitForTransactionReceipt({
            hash: completeTxHash,
          });

          const profit = job.totalBudget - job.totalSpent - task.reward;
          const profitUsd = await ethToUsd(profit);
          costTracker.logRevenue({ type: 'job_profit', amount_usd: profitUsd });

          this.emit('action', {
            type: 'job_completed',
            jobId: jobId.toString(),
            profit: formatEther(profit),
            profitUsd,
            timestamp: Date.now(),
          });
          this.emit('transaction', {
            action: 'Complete job + withdraw profit',
            hash: completeTxHash,
            amount: formatEther(profit),
            timestamp: Date.now(),
          });
        }

        this.emitMetrics();
      } else {
        try {
          await updateWorkerReputation(task.worker, false, result.scores);
          await recordVerification(
            task.worker,
            taskId.toString(),
            jobId.toString(),
            false,
            result.confidence,
            result.scores,
            '0',
          );
        } catch (err) {
          console.error(
            `Reputation update error on rejection for task ${taskId}:`,
            err,
          );
        }

        const rejectTxHash = await rejectProofOnChain(
          jobId,
          taskId,
          result.suggestion,
        );
        costTracker.logCost({
          type: 'gas',
          amount_usd: 0.001,
          details: `rejectProof-${taskId}`,
        });

        this.emit('action', {
          type: 'proof_rejected',
          jobId: jobId.toString(),
          taskId: taskId.toString(),
          reason: result.suggestion,
          timestamp: Date.now(),
        });
        this.emit('transaction', {
          action: 'Reject proof',
          hash: rejectTxHash,
          timestamp: Date.now(),
        });
        this.emitMetrics();
      }
    } catch (err) {
      console.error(`Error handling ProofSubmitted ${jobId}/${taskId}:`, err);
    }
  }
}
