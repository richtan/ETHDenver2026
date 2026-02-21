#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * MCP integration test script — exercises every tool and resource
 * against a running taskmaster-agent MCP server.
 *
 * Usage:
 *   npx tsx test-mcp.ts                   # defaults to http://localhost:3001/mcp
 *   npx tsx test-mcp.ts http://host:port/mcp
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ─── Config ──────────────────────────────────────────────────────────
const MCP_URL = process.argv[2] || "http://localhost:3001/mcp";

const SAMPLE_JOB_ID = "0";
const SAMPLE_TASK_ID = "0";
const SAMPLE_WORKER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const SAMPLE_JOB_DESC = "Build a landing page for a DeFi protocol";
const SAMPLE_BUDGET = "0.01";

// ─── Helpers ─────────────────────────────────────────────────────────
interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  responseSnippet?: string;
}

const results: TestResult[] = [];

function snippet(data: unknown, maxLen = 200): string {
  const s = typeof data === "string" ? data : JSON.stringify(data);
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

async function runTest(
  name: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  const t0 = performance.now();
  try {
    const res = await fn();
    results.push({
      name,
      passed: true,
      durationMs: Math.round(performance.now() - t0),
      responseSnippet: snippet(res),
    });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      durationMs: Math.round(performance.now() - t0),
      error: err?.message ?? String(err),
    });
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nMCP Test Suite — target: ${MCP_URL}\n`);

  // 1. Connect
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "mcp-test-harness", version: "1.0.0" });

  console.log("Connecting to MCP server…");
  await client.connect(transport);
  console.log("Session established.\n");

  // ── Tools ──────────────────────────────────────────────────────────

  await runTest("tools/list", async () => {
    const { tools } = await client.listTools();
    console.log(`  Found ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
    const expected = [
      "clarify_job",
      "create_job",
      "get_job_status",
      "get_job_tasks",
      "list_open_tasks",
      "get_task_status",
      "get_ai_task_results",
      "get_worker_reputation",
      "get_worker_history",
      "get_agent_metrics",
      "get_agent_actions",
    ];
    const missing = expected.filter((e) => !tools.some((t) => t.name === e));
    if (missing.length) throw new Error(`Missing tools: ${missing.join(", ")}`);
    return tools.map((t) => t.name);
  });

  await runTest("tool: clarify_job", async () => {
    const res = await client.callTool({
      name: "clarify_job",
      arguments: {
        description: SAMPLE_JOB_DESC,
        budget: SAMPLE_BUDGET,
        conversation: [],
      },
    });
    return res.content;
  });

  await runTest("tool: create_job", async () => {
    const res = await client.callTool({
      name: "create_job",
      arguments: {
        description: "Test job created via MCP test harness",
        budget: "0.001",
      },
    });
    if (res.isError) throw new Error(JSON.stringify(res.content));
    return res.content;
  });

  await runTest("tool: get_job_status", async () => {
    const res = await client.callTool({
      name: "get_job_status",
      arguments: { jobId: SAMPLE_JOB_ID },
    });
    return res.content;
  });

  await runTest("tool: get_job_tasks", async () => {
    const res = await client.callTool({
      name: "get_job_tasks",
      arguments: { jobId: SAMPLE_JOB_ID },
    });
    return res.content;
  });

  await runTest("tool: list_open_tasks", async () => {
    const res = await client.callTool({
      name: "list_open_tasks",
      arguments: {},
    });
    return res.content;
  });

  await runTest("tool: get_task_status", async () => {
    const res = await client.callTool({
      name: "get_task_status",
      arguments: { taskId: SAMPLE_TASK_ID },
    });
    return res.content;
  });

  await runTest("tool: get_ai_task_results", async () => {
    const res = await client.callTool({
      name: "get_ai_task_results",
      arguments: { jobId: SAMPLE_JOB_ID },
    });
    return res.content;
  });

  await runTest("tool: get_worker_reputation", async () => {
    const res = await client.callTool({
      name: "get_worker_reputation",
      arguments: { address: SAMPLE_WORKER },
    });
    return res.content;
  });

  await runTest("tool: get_worker_history", async () => {
    const res = await client.callTool({
      name: "get_worker_history",
      arguments: { address: SAMPLE_WORKER, limit: 5 },
    });
    return res.content;
  });

  await runTest("tool: get_agent_metrics", async () => {
    const res = await client.callTool({
      name: "get_agent_metrics",
      arguments: {},
    });
    return res.content;
  });

  await runTest("tool: get_agent_actions", async () => {
    const res = await client.callTool({
      name: "get_agent_actions",
      arguments: { limit: 5 },
    });
    return res.content;
  });

  // ── Resources ──────────────────────────────────────────────────────

  await runTest("resources/list", async () => {
    const { resources } = await client.listResources();
    console.log(`  Found ${resources.length} static resources: ${resources.map((r) => r.uri).join(", ")}`);
    return resources.map((r) => r.uri);
  });

  await runTest("resource_templates/list", async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    console.log(`  Found ${resourceTemplates.length} resource templates: ${resourceTemplates.map((r) => r.uriTemplate).join(", ")}`);
    return resourceTemplates.map((r) => r.uriTemplate);
  });

  await runTest("resource: taskmaster://metrics", async () => {
    const res = await client.readResource({ uri: "taskmaster://metrics" });
    return res.contents;
  });

  await runTest("resource: taskmaster://actions", async () => {
    const res = await client.readResource({ uri: "taskmaster://actions" });
    return res.contents;
  });

  await runTest("resource: taskmaster://jobs/0", async () => {
    const res = await client.readResource({ uri: "taskmaster://jobs/0" });
    return res.contents;
  });

  await runTest("resource: taskmaster://workers/.../reputation", async () => {
    const res = await client.readResource({
      uri: `taskmaster://workers/${SAMPLE_WORKER}/reputation`,
    });
    return res.contents;
  });

  // ── Cleanup ────────────────────────────────────────────────────────
  await client.close();

  // ── Report ─────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(72));
  console.log("  MCP TEST RESULTS");
  console.log("═".repeat(72));

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    const dur = `${r.durationMs}ms`.padStart(7);
    console.log(`  [${icon}] ${dur}  ${r.name}`);
    if (r.error) {
      console.log(`                   Error: ${r.error}`);
    }
    if (r.passed && r.responseSnippet) {
      console.log(`                   -> ${r.responseSnippet}`);
    }
  }

  console.log("─".repeat(72));
  console.log(
    `  Total: ${results.length}  |  Passed: ${passed.length}  |  Failed: ${failed.length}`,
  );
  console.log("═".repeat(72) + "\n");

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
