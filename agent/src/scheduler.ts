import { publicClient } from "./client.js";
import { config } from "./config.js";
import { JOB_MARKETPLACE_ABI } from "./abi.js";
import { expireTaskOnChain } from "./actions/marketplace.js";
import { usdToEth } from "./price-feed.js";
import { appendBuilderCode } from "./erc8021.js";
import { costTracker } from "./cost-tracker.js";
import { type AgentWallet } from "./wallet.js";
import { type JobOrchestrator } from "./orchestrator.js";
import { parseEther, type Address } from "viem";

const REIMBURSEMENT_THRESHOLD = 0.05;

let orchestratorRef: JobOrchestrator;

export function startScheduler(wallet: AgentWallet, orchestrator: JobOrchestrator) {
  orchestratorRef = orchestrator;

  setInterval(() => scanExpiredTasks(), 5 * 60 * 1000);
  setInterval(() => reimburseComputeCosts(wallet, orchestratorRef), 10 * 60 * 1000);

  console.log("Scheduler started (expire check: 5min, reimbursement: 10min)");
}

async function scanExpiredTasks() {
  try {
    const nextTaskId = await publicClient.readContract({
      address: config.contractAddress,
      abi: JOB_MARKETPLACE_ABI,
      functionName: "nextTaskId",
    }) as bigint;

    const now = BigInt(Math.floor(Date.now() / 1000));

    for (let i = 0n; i < nextTaskId; i++) {
      const task = await publicClient.readContract({
        address: config.contractAddress,
        abi: JOB_MARKETPLACE_ABI,
        functionName: "getTask",
        args: [i],
      }) as any;
      const isExpirable = task.status === 2 || task.status === 3; // Accepted or PendingVerification
      if (isExpirable && task.deadline > 0n && now >= task.deadline) {
        console.log(`Expiring task ${i} (past deadline)`);
        await expireTaskOnChain(task.jobId, i);
      }
    }
  } catch (err) {
    console.error("Scheduler: error scanning expired tasks:", err);
  }
}

async function reimburseComputeCosts(wallet: AgentWallet, orchestrator?: JobOrchestrator) {
  if (!config.reimbursementEnabled) return;

  try {
    const unreimbursed = costTracker.getUnreimbursedOffchainCosts();
    if (unreimbursed > REIMBURSEMENT_THRESHOLD) {
      const ethAmount = await usdToEth(unreimbursed);
      const txHash = await wallet.sendTransaction({
        to: process.env.OPERATOR_WALLET_ADDRESS as Address,
        value: parseEther(ethAmount.toFixed(18)),
        data: appendBuilderCode("0x"),
      });
      costTracker.markReimbursed(unreimbursed, txHash);
      orchestrator?.emit("action", {
        type: "compute_reimbursed", amount_usd: unreimbursed, txHash, timestamp: Date.now(),
      });
      orchestrator?.emit("transaction", {
        action: "Reimburse compute", hash: txHash, amount: ethAmount.toFixed(6), timestamp: Date.now(),
      });
      console.log(`Reimbursed $${unreimbursed.toFixed(4)} in compute costs`);
    }
  } catch (err) {
    console.error("Scheduler: error reimbursing compute:", err);
  }
}
