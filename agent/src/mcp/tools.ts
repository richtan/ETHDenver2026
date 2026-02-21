import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatEther, parseEther, decodeEventLog } from "viem";
import { type JobOrchestrator } from "../orchestrator.js";
import { publicClient } from "../client.js";
import { config } from "../config.js";
import { JOB_MARKETPLACE_ABI } from "../abi.js";
import { clarifyJob } from "../clarifier.js";
import { readJobFromContract, readTaskFromContract } from "../contract-reads.js";
import { getAiTaskResults, getWorkerReputation, getReputationTier, getVerificationHistory } from "../supabase.js";
import { costTracker } from "../cost-tracker.js";
import { createJobOnChain } from "../actions/marketplace.js";

export type OrchestratorRef = { current: JobOrchestrator | null };

/** Serialize any value, converting BigInts to strings */
function serialize(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: serialize(data) }] };
}

function errorResult(err: unknown) {
  return {
    content: [{ type: "text" as const, text: String(err) }],
    isError: true,
  };
}

export function registerTools(server: McpServer, orchestratorRef: OrchestratorRef) {
  // 1. clarify_job
  server.tool(
    "clarify_job",
    "Multi-round job clarification — returns questions or a final task plan",
    {
      description: z.string().describe("Job description from the client"),
      budget: z.string().describe("Budget in ETH (e.g. '0.01')"),
      conversation: z.array(z.object({
        question: z.string(),
        answer: z.string(),
      })).default([]).describe("Prior Q&A rounds"),
    },
    async ({ description, budget, conversation }) => {
      try {
        const result = await clarifyJob(description, budget, conversation);
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 2. create_job
  server.tool(
    "create_job",
    "Create a new job on-chain with a description and ETH budget",
    {
      description: z.string().describe("Job description"),
      budget: z.string().describe("Budget in ETH (e.g. '0.01')"),
    },
    async ({ description, budget }) => {
      try {
        const budgetWei = parseEther(budget);
        const txHash = await createJobOnChain(description, budgetWei);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        let jobId: string | undefined;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: JOB_MARKETPLACE_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "JobCreated") {
              jobId = ((decoded.args as any).jobId as bigint).toString();
              break;
            }
          } catch { /* not our event */ }
        }

        return textResult({
          txHash,
          blockNumber: receipt.blockNumber.toString(),
          jobId: jobId ?? "check transaction receipt",
          budget,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 3. get_job_status
  server.tool(
    "get_job_status",
    "Get on-chain job details by job ID",
    { jobId: z.string().describe("Job ID") },
    async ({ jobId }) => {
      try {
        const job = await readJobFromContract(BigInt(jobId));
        return textResult(job);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 3. get_job_tasks
  server.tool(
    "get_job_tasks",
    "Get all tasks for a job from the contract",
    { jobId: z.string().describe("Job ID") },
    async ({ jobId }) => {
      try {
        const tasks = await publicClient.readContract({
          address: config.contractAddress,
          abi: JOB_MARKETPLACE_ABI,
          functionName: "getJobTasks",
          args: [BigInt(jobId)],
        });
        return textResult(tasks);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 4. list_open_tasks
  server.tool(
    "list_open_tasks",
    "List all open (available) tasks on the contract",
    {},
    async () => {
      try {
        const tasks = await publicClient.readContract({
          address: config.contractAddress,
          abi: JOB_MARKETPLACE_ABI,
          functionName: "getOpenTasks",
        });
        return textResult(tasks);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 5. get_task_status
  server.tool(
    "get_task_status",
    "Get on-chain task details by task ID",
    { taskId: z.string().describe("Task ID") },
    async ({ taskId }) => {
      try {
        const task = await readTaskFromContract(BigInt(taskId));
        return textResult(task);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 6. get_ai_task_results
  server.tool(
    "get_ai_task_results",
    "Get AI research/execution results for a job",
    { jobId: z.string().describe("Job ID") },
    async ({ jobId }) => {
      try {
        const results = await getAiTaskResults(jobId);
        return textResult(results);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 7. get_worker_reputation
  server.tool(
    "get_worker_reputation",
    "Get a worker's reputation score and tier",
    { address: z.string().describe("Worker wallet address") },
    async ({ address }) => {
      try {
        const rep = await getWorkerReputation(address);
        if (!rep) return textResult({ found: false });
        const tier = getReputationTier(rep.reputation_score, rep.tasks_completed);
        return textResult({ ...rep, tier });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 8. get_worker_history
  server.tool(
    "get_worker_history",
    "Get a worker's verification audit trail",
    {
      address: z.string().describe("Worker wallet address"),
      limit: z.number().default(20).describe("Max records to return"),
    },
    async ({ address, limit }) => {
      try {
        const history = await getVerificationHistory(address, limit);
        return textResult(history);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 9. get_agent_metrics
  server.tool(
    "get_agent_metrics",
    "Get the agent's financial P&L metrics",
    {},
    async () => {
      try {
        const metrics = costTracker.getMetricsSnapshot();
        return textResult(metrics);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // 10. get_agent_actions
  server.tool(
    "get_agent_actions",
    "Get the agent's recent event log",
    { limit: z.number().default(50).describe("Max actions to return") },
    async ({ limit }) => {
      try {
        if (!orchestratorRef.current) {
          return errorResult("Agent is still initializing. Please try again shortly.");
        }
        const actions = orchestratorRef.current.getRecentActions().slice(0, limit);
        return textResult(actions);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
