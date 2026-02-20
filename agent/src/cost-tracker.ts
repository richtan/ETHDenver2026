import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { type Metrics } from "./types.js";

interface CostEntry { type: "openai" | "gas"; amount_usd: number; details: string; timestamp: number; }
interface RevenueEntry { type: "job_profit" | "ai_service" | "fee"; amount_usd: number; timestamp: number; }
interface ReimbursementEntry { amount_usd: number; txHash: string; timestamp: number; }

export interface OperationLine {
  label: string;
  calls: number;
  costPerCall: number;
  totalCost: number;
}

export interface ProfitDetails {
  openaiLines: OperationLine[];
  gasLines: OperationLine[];
  revenueLines: { label: string; amount: number; count: number }[];
  autonomyMetrics: {
    costCoverageRatio: number;
    revenuePerJob: number;
    costPerJob: number;
    profitMarginPct: number;
    openaiAsCostPct: number;
    gasAsCostPct: number;
  };
  pnl: {
    totalRevenue: number;
    openaiCosts: number;
    gasCosts: number;
    workerCosts: number;
    netProfit: number;
  };
}

const OPENAI_OPS = [
  { prefix: "decompose-job",       label: "GPT-4o · Decomposition",       costPerCall: 0.02 },
  { prefix: "ai-task-",            label: "GPT-4o · AI Task Execution",   costPerCall: 0.02 },
  { prefix: "verify-task-",        label: "GPT-4o Vision · Verification", costPerCall: 0.05 },
  { prefix: "ai-service-analyze",  label: "GPT-4o Vision · Analyze",      costPerCall: 0.01 },
  { prefix: "ai-service-classify", label: "GPT-4o · Classify",            costPerCall: 0.005 },
  { prefix: "ai-service-verify",   label: "GPT-4o Vision · Verify Photo", costPerCall: 0.01 },
];

const GAS_OPS = [
  { prefix: "addTask-",     label: "Gas · Add Task",     costPerCall: 0.001 },
  { prefix: "approveTask-", label: "Gas · Approve Task", costPerCall: 0.001 },
  { prefix: "completeJob-", label: "Gas · Complete Job", costPerCall: 0.001 },
  { prefix: "rejectProof-", label: "Gas · Reject Proof", costPerCall: 0.001 },
  { prefix: "reputation-bonus", label: "Gas · Reputation Bonus", costPerCall: 0.001 },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSISTENCE_PATH = join(__dirname, "..", "cost-tracker.json");

class CostTracker {
  private costs: CostEntry[] = [];
  private revenues: RevenueEntry[] = [];
  private reimbursements: ReimbursementEntry[] = [];

  constructor() {
    if (existsSync(PERSISTENCE_PATH)) {
      try {
        const data = JSON.parse(readFileSync(PERSISTENCE_PATH, "utf-8"));
        this.costs = data.costs || [];
        this.revenues = data.revenues || [];
        this.reimbursements = data.reimbursements || [];
      } catch {
        // Corrupted file, start fresh
      }
    }
  }

  logCost(entry: Omit<CostEntry, "timestamp">) {
    this.costs.push({ ...entry, timestamp: Date.now() });
    this.persist();
  }

  logRevenue(entry: Omit<RevenueEntry, "timestamp">) {
    this.revenues.push({ ...entry, timestamp: Date.now() });
    this.persist();
  }

  getUnreimbursedOffchainCosts(): number {
    const totalOffchain = this.costs
      .filter(c => c.type === "openai")
      .reduce((sum, c) => sum + c.amount_usd, 0);
    const totalReimbursed = this.reimbursements.reduce((sum, r) => sum + r.amount_usd, 0);
    return totalOffchain - totalReimbursed;
  }

  markReimbursed(amount: number, txHash: string) {
    this.reimbursements.push({ amount_usd: amount, txHash, timestamp: Date.now() });
    this.persist();
  }

  getMetricsSnapshot(): Metrics {
    const totalCosts = this.costs.reduce((s, c) => s + c.amount_usd, 0);
    const totalRevenue = this.revenues.reduce((s, r) => s + r.amount_usd, 0);
    const openaiCosts = this.costs.filter(c => c.type === "openai").reduce((s, c) => s + c.amount_usd, 0);
    const gasCosts = this.costs.filter(c => c.type === "gas").reduce((s, c) => s + c.amount_usd, 0);
    const jobProfits = this.revenues.filter(r => r.type === "job_profit").reduce((s, r) => s + r.amount_usd, 0);
    const aiServices = this.revenues.filter(r => r.type === "ai_service").reduce((s, r) => s + r.amount_usd, 0);
    return {
      netProfitUsd: totalRevenue - totalCosts,
      totalRevenueUsd: totalRevenue,
      totalCostsUsd: totalCosts,
      jobsCompleted: this.revenues.filter(r => r.type === "job_profit").length,
      jobsInProgress: 0,
      sustainabilityRatio: totalCosts > 0 ? totalRevenue / totalCosts : 0,
      costBreakdown: { openai: openaiCosts, gas: gasCosts, workers: 0 },
      revenueBreakdown: { jobProfits, aiServices, fees: 0 },
    };
  }

  getReimbursements() { return this.reimbursements; }

  getProfitDetails(): ProfitDetails {
    const openaiCosts = this.costs.filter(c => c.type === "openai");
    const gasCosts = this.costs.filter(c => c.type === "gas");
    const totalRevenue = this.revenues.reduce((s, r) => s + r.amount_usd, 0);
    const totalOpenai = openaiCosts.reduce((s, c) => s + c.amount_usd, 0);
    const totalGas = gasCosts.reduce((s, c) => s + c.amount_usd, 0);
    const totalCosts = totalOpenai + totalGas;
    const netProfit = totalRevenue - totalCosts;
    const jobsCompleted = this.revenues.filter(r => r.type === "job_profit").length;

    // Build OpenAI operation lines
    const matchedOpenaiIds = new Set<number>();
    const openaiLines: OperationLine[] = [];
    for (const op of OPENAI_OPS) {
      const matched = openaiCosts.filter((c, i) => {
        if (c.details.startsWith(op.prefix)) { matchedOpenaiIds.add(i); return true; }
        return false;
      });
      if (matched.length > 0) {
        openaiLines.push({ label: op.label, calls: matched.length, costPerCall: op.costPerCall, totalCost: matched.reduce((s, c) => s + c.amount_usd, 0) });
      }
    }
    // Unmatched OpenAI costs → "Other"
    const otherOpenai = openaiCosts.filter((_, i) => !matchedOpenaiIds.has(i));
    if (otherOpenai.length > 0) {
      const total = otherOpenai.reduce((s, c) => s + c.amount_usd, 0);
      openaiLines.push({ label: "GPT-4o · Other", calls: otherOpenai.length, costPerCall: total / otherOpenai.length, totalCost: total });
    }
    openaiLines.sort((a, b) => b.totalCost - a.totalCost);

    // Build gas operation lines
    const matchedGasIds = new Set<number>();
    const gasLines: OperationLine[] = [];
    for (const op of GAS_OPS) {
      const matched = gasCosts.filter((c, i) => {
        if (c.details.startsWith(op.prefix)) { matchedGasIds.add(i); return true; }
        return false;
      });
      if (matched.length > 0) {
        gasLines.push({ label: op.label, calls: matched.length, costPerCall: op.costPerCall, totalCost: matched.reduce((s, c) => s + c.amount_usd, 0) });
      }
    }
    const otherGas = gasCosts.filter((_, i) => !matchedGasIds.has(i));
    if (otherGas.length > 0) {
      const total = otherGas.reduce((s, c) => s + c.amount_usd, 0);
      gasLines.push({ label: "Gas · Other", calls: otherGas.length, costPerCall: total / otherGas.length, totalCost: total });
    }
    gasLines.sort((a, b) => b.totalCost - a.totalCost);

    // Revenue lines
    const jobProfitAmt = this.revenues.filter(r => r.type === "job_profit").reduce((s, r) => s + r.amount_usd, 0);
    const aiServiceAmt = this.revenues.filter(r => r.type === "ai_service").reduce((s, r) => s + r.amount_usd, 0);
    const feeAmt = this.revenues.filter(r => r.type === "fee").reduce((s, r) => s + r.amount_usd, 0);
    const revenueLines = [
      { label: "Job Completions", amount: jobProfitAmt, count: this.revenues.filter(r => r.type === "job_profit").length },
      { label: "AI Services Sold", amount: aiServiceAmt, count: this.revenues.filter(r => r.type === "ai_service").length },
      { label: "Protocol Fees", amount: feeAmt, count: this.revenues.filter(r => r.type === "fee").length },
    ].filter(l => l.count > 0 || l.amount > 0);

    return {
      openaiLines,
      gasLines,
      revenueLines,
      autonomyMetrics: {
        costCoverageRatio: totalCosts > 0 ? totalRevenue / totalCosts : 0,
        revenuePerJob: jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0,
        costPerJob: jobsCompleted > 0 ? totalCosts / jobsCompleted : 0,
        profitMarginPct: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        openaiAsCostPct: totalCosts > 0 ? (totalOpenai / totalCosts) * 100 : 0,
        gasAsCostPct: totalCosts > 0 ? (totalGas / totalCosts) * 100 : 0,
      },
      pnl: { totalRevenue, openaiCosts: totalOpenai, gasCosts: totalGas, workerCosts: 0, netProfit },
    };
  }

  private persist() {
    try {
      writeFileSync(PERSISTENCE_PATH, JSON.stringify({
        costs: this.costs, revenues: this.revenues, reimbursements: this.reimbursements,
      }, null, 2));
    } catch (err) {
      console.error("Failed to persist cost tracker:", err);
    }
  }
}

export const costTracker = new CostTracker();
