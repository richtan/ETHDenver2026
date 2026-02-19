import { test, expect, beforeAll, afterAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { JOB_MARKETPLACE_ABI } from "../abi.js";
import { config } from "../config.js";
import { publicClient } from "../client.js";
import { createAgentWallet } from "../wallet.js";
import { setAgentWallet } from "../actions/marketplace.js";
import { setRouteWallet } from "../x402/routes.js";
import { JobOrchestrator } from "../orchestrator.js";
import { costTracker } from "../cost-tracker.js";

const CONTRACT = config.contractAddress;
const RPC = config.rpcUrl;

const anvilChain = config.chain;

const CLIENT_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const;
const WORKER_KEY =
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const;

const clientAccount = privateKeyToAccount(CLIENT_KEY);
const workerAccount = privateKeyToAccount(WORKER_KEY);

const clientWallet = createWalletClient({
  account: clientAccount,
  chain: anvilChain,
  transport: http(RPC),
});
const workerWallet = createWalletClient({
  account: workerAccount,
  chain: anvilChain,
  transport: http(RPC),
});

let orchestrator: JobOrchestrator;

async function waitFor(
  fn: () => Promise<boolean>,
  label: string,
  timeoutMs = 30_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`waitFor timed out: ${label}`);
}

async function readJob(jobId: bigint) {
  return publicClient.readContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getJob",
    args: [jobId],
  });
}

async function readTask(taskId: bigint) {
  return publicClient.readContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getTask",
    args: [taskId],
  });
}

async function readJobTasks(jobId: bigint) {
  return publicClient.readContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getJobTasks",
    args: [jobId],
  });
}

beforeAll(async () => {
  const wallet = await createAgentWallet();
  setAgentWallet(wallet);
  setRouteWallet(wallet);

  const contractAgent = await publicClient.readContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "agent",
  });
  expect((contractAgent as string).toLowerCase()).toBe(
    wallet.address.toLowerCase(),
  );

  orchestrator = new JobOrchestrator();
  orchestrator.startListening();
});

afterAll(() => {
  // Let the process exit; event watchers auto-clean up
});

test("full lifecycle: create job → decompose → accept → prove → verify → complete", async () => {
  const JOB_ID = 0n;
  const BUDGET = parseEther("0.01");

  // ── Step 1: Client creates job ──────────────────────────────────
  const createHash = await clientWallet.writeContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "createJob",
    args: ["Design and distribute promotional flyers for a DeFi product"],
    value: BUDGET,
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });

  const jobAfterCreate = await readJob(JOB_ID);
  expect(jobAfterCreate.client.toLowerCase()).toBe(
    clientAccount.address.toLowerCase(),
  );
  expect(jobAfterCreate.totalBudget).toBe(BUDGET);

  // ── Step 2: Wait for agent to decompose into 2 tasks ────────────
  await waitFor(async () => {
    const tasks = await readJobTasks(JOB_ID);
    return tasks.length === 2;
  }, "agent decomposes job into 2 tasks");

  const tasksAfterDecompose = await readJobTasks(JOB_ID);
  expect(tasksAfterDecompose.length).toBe(2);

  const task0Id = tasksAfterDecompose[0].id;
  const task1Id = tasksAfterDecompose[1].id;

  // Task 0 should be Open (1), Task 1 should be Pending (0)
  expect(tasksAfterDecompose[0].status).toBe(1); // Open
  expect(tasksAfterDecompose[1].status).toBe(0); // Pending

  const jobAfterDecompose = await readJob(JOB_ID);
  expect(jobAfterDecompose.status).toBe(1); // InProgress

  // ── Step 3: Worker accepts Task 0 ──────────────────────────────
  const accept0Hash = await workerWallet.writeContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "acceptTask",
    args: [JOB_ID, task0Id],
  });
  await publicClient.waitForTransactionReceipt({ hash: accept0Hash });

  const task0AfterAccept = await readTask(task0Id);
  expect(task0AfterAccept.status).toBe(2); // Accepted
  expect(task0AfterAccept.worker.toLowerCase()).toBe(
    workerAccount.address.toLowerCase(),
  );

  // ── Step 4: Worker submits proof for Task 0 ────────────────────
  const workerBalanceBefore = await publicClient.getBalance({
    address: workerAccount.address,
  });

  const submit0Hash = await workerWallet.writeContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "submitProof",
    args: [JOB_ID, task0Id, "ipfs://QmTestProof1"],
  });
  await publicClient.waitForTransactionReceipt({ hash: submit0Hash });

  // ── Step 5: Wait for agent to verify and approve Task 0 ────────
  await waitFor(async () => {
    const t = await readTask(task0Id);
    return t.status === 4; // Completed
  }, "agent verifies and approves task 0");

  const task0Completed = await readTask(task0Id);
  expect(task0Completed.status).toBe(4); // Completed
  expect(task0Completed.deliverableURI).toBe("ipfs://QmTestProof1");

  // Task 1 should now be Open
  const task1AfterApprove = await readTask(task1Id);
  expect(task1AfterApprove.status).toBe(1); // Open

  // Worker should have received the reward (approximately — gas costs offset)
  const workerBalanceAfter = await publicClient.getBalance({
    address: workerAccount.address,
  });
  const reward0 = tasksAfterDecompose[0].reward;
  const balanceIncrease = workerBalanceAfter - workerBalanceBefore;
  // Balance increase should be roughly the reward minus gas spent on accept+submit txs
  // Just verify it went up by at least half the reward (gas is negligible on anvil)
  expect(balanceIncrease).toBeGreaterThan(reward0 / 2n);

  // ── Step 6: Worker accepts Task 1 ──────────────────────────────
  const accept1Hash = await workerWallet.writeContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "acceptTask",
    args: [JOB_ID, task1Id],
  });
  await publicClient.waitForTransactionReceipt({ hash: accept1Hash });

  const task1AfterAccept = await readTask(task1Id);
  expect(task1AfterAccept.status).toBe(2); // Accepted

  // ── Step 7: Worker submits proof for Task 1 ────────────────────
  const agentBalanceBefore = await publicClient.getBalance({
    address: (await createAgentWallet()).address,
  });

  const submit1Hash = await workerWallet.writeContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "submitProof",
    args: [JOB_ID, task1Id, "ipfs://QmTestProof2"],
  });
  await publicClient.waitForTransactionReceipt({ hash: submit1Hash });

  // ── Step 8: Wait for agent to verify, approve, and complete job ─
  await waitFor(async () => {
    const j = await readJob(JOB_ID);
    return j.status === 2; // Completed
  }, "agent verifies task 1 and completes job");

  const finalJob = await readJob(JOB_ID);
  expect(finalJob.status).toBe(2); // Completed

  const task1Completed = await readTask(task1Id);
  expect(task1Completed.status).toBe(4); // Completed
  expect(task1Completed.deliverableURI).toBe("ipfs://QmTestProof2");

  // Agent wallet should have received profit (budget - 2 rewards)
  const expectedProfit = BUDGET - reward0 - tasksAfterDecompose[1].reward;
  expect(expectedProfit).toBeGreaterThan(0n);

  const agentBalanceAfter = await publicClient.getBalance({
    address: (await createAgentWallet()).address,
  });
  // Agent balance change should reflect profit minus gas for addTask x2, approve x2, complete
  // Just verify the job is marked completed and profit is positive
  expect(finalJob.totalBudget - finalJob.totalSpent).toBe(expectedProfit);

  // ── Step 9: Verify cost tracker has entries ─────────────────────
  const metrics = costTracker.getMetricsSnapshot();
  expect(metrics.totalCostsUsd).toBeGreaterThan(0);
  expect(metrics.totalRevenueUsd).toBeGreaterThan(0);
  expect(metrics.jobsCompleted).toBe(1);

  // Verify on-chain stats
  const stats = await publicClient.readContract({
    address: CONTRACT,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getAgentStats",
  });
  const [totalJobsCompleted, totalEarnedByAgent, totalPaidToWorkers] =
    stats as [bigint, bigint, bigint, bigint];
  expect(totalJobsCompleted).toBe(1n);
  expect(totalEarnedByAgent).toBe(expectedProfit);
  expect(totalPaidToWorkers).toBe(reward0 + tasksAfterDecompose[1].reward);

  console.log("\n=== E2E Test Summary ===");
  console.log(`Job budget:     ${formatEther(BUDGET)} ETH`);
  console.log(`Worker paid:    ${formatEther(totalPaidToWorkers)} ETH`);
  console.log(`Agent profit:   ${formatEther(totalEarnedByAgent)} ETH`);
  console.log(`Profit USD:     $${metrics.totalRevenueUsd.toFixed(2)}`);
  console.log(`Total costs:    $${metrics.totalCostsUsd.toFixed(4)}`);
  console.log(`Sustainability: ${metrics.sustainabilityRatio.toFixed(1)}x`);
});
