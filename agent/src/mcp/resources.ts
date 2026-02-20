import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type JobOrchestrator } from "../orchestrator.js";
import { readJobFromContract } from "../contract-reads.js";
import { getWorkerReputation, getReputationTier } from "../supabase.js";
import { costTracker } from "../cost-tracker.js";

/** Serialize any value, converting BigInts to strings */
function serialize(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export function registerResources(server: McpServer, orchestrator: JobOrchestrator) {
  // Static: agent metrics
  server.resource(
    "agent-metrics",
    "taskmaster://metrics",
    { description: "Agent financial metrics (P&L, costs, revenue)" },
    async () => ({
      contents: [{
        uri: "taskmaster://metrics",
        mimeType: "application/json",
        text: serialize(costTracker.getMetricsSnapshot()),
      }],
    }),
  );

  // Static: recent actions
  server.resource(
    "agent-actions",
    "taskmaster://actions",
    { description: "Recent agent event log" },
    async () => ({
      contents: [{
        uri: "taskmaster://actions",
        mimeType: "application/json",
        text: serialize(orchestrator.getRecentActions()),
      }],
    }),
  );

  // Template: job details
  server.resource(
    "job-details",
    new ResourceTemplate("taskmaster://jobs/{jobId}", { list: undefined }),
    { description: "On-chain job details by ID" },
    async (uri, variables) => {
      const jobId = variables.jobId as string;
      const job = await readJobFromContract(BigInt(jobId));
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: serialize(job),
        }],
      };
    },
  );

  // Template: worker reputation
  server.resource(
    "worker-reputation",
    new ResourceTemplate("taskmaster://workers/{address}/reputation", { list: undefined }),
    { description: "Worker reputation score and tier" },
    async (uri, variables) => {
      const address = variables.address as string;
      const rep = await getWorkerReputation(address);
      const result = rep
        ? { ...rep, tier: getReputationTier(rep.reputation_score, rep.tasks_completed) }
        : { found: false };
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: serialize(result),
        }],
      };
    },
  );
}
