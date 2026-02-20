import { type Metrics } from "./types.js";
import {
  insertCostEntry, insertRevenueEntry, insertReimbursementEntry,
  getAllCostEntries, getAllRevenueEntries, getAllReimbursementEntries,
} from "./supabase.js";

interface CostEntry { type: "openai" | "gas" | "pinata"; amount_usd: number; details: string; timestamp: number; }
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
  pinataLines: OperationLine[];
  revenueLines: { label: string; amount: number; count: number }[];
  autonomyMetrics: {
    costCoverageRatio: number;
    revenuePerJob: number;
    costPerJob: number;
    profitMarginPct: number;
    openaiAsCostPct: number;
    gasAsCostPct: number;
    pinataAsCostPct: number;
  };
  pnl: {
    totalRevenue: number;
    openaiCosts: number;
    gasCosts: number;
    pinataCosts: number;
    workerCosts: number;
    netProfit: number;
  };
}

const OPENAI_OPS = [
  { prefix: "clarify-job",         label: "GPT-4o · Clarification",       costPerCall: 0.02 },
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

const PINATA_PLANS: Record<string, { pin: number; gateway: number; storageLimitBytes: number }> = {
  free:   { pin: 0,    gateway: 0,     storageLimitBytes: 1 * 1024 * 1024 * 1024 },
  picnic: { pin: 0.02, gateway: 0.002, storageLimitBytes: 1024 * 1024 * 1024 * 1024 },
  fiesta: { pin: 0.01, gateway: 0.001, storageLimitBytes: 5 * 1024 * 1024 * 1024 * 1024 },
};
const PINATA_OVERAGE = PINATA_PLANS.picnic;
export const pinataConfig = {
  plan: (process.env.PINATA_PLAN || "free") as string,
  ...(PINATA_PLANS[process.env.PINATA_PLAN || "free"] ?? PINATA_PLANS.free),
};

const PINATA_OPS = [
  { prefix: "pinata-pin",     label: "Pinata · Pin Upload",    costPerCall: pinataConfig.pin },
  { prefix: "pinata-gateway", label: "Pinata · Gateway Fetch", costPerCall: pinataConfig.gateway },
];

class CostTracker {
  private costs: CostEntry[] = [];
  private revenues: RevenueEntry[] = [];
  private reimbursements: ReimbursementEntry[] = [];
  private pinataBytesUsed = 0;
  private pinataFileCount = 0;

  async initialize() {
    try {
      this.costs = await getAllCostEntries();
      this.revenues = await getAllRevenueEntries();
      this.reimbursements = await getAllReimbursementEntries();

      // Restore Pinata counters from historical pin entries.
      // Byte sizes aren't stored in cost entries, so estimate ~200KB per
      // compressed image (matches the 0.2 MB maxSizeMB compression setting).
      const AVG_BYTES_PER_PIN = 200 * 1024;
      const historicalPins = this.costs.filter(
        c => c.type === "pinata" && c.details.startsWith("pinata-pin"),
      );
      this.pinataFileCount = historicalPins.length;
      this.pinataBytesUsed = historicalPins.length * AVG_BYTES_PER_PIN;

      console.log(`Loaded ${this.costs.length} costs, ${this.revenues.length} revenues from Supabase`);
      if (this.pinataFileCount > 0) {
        console.log(`Restored Pinata usage: ${this.pinataFileCount} pins, ~${(this.pinataBytesUsed / (1024 * 1024)).toFixed(1)} MB`);
      }
    } catch (err) {
      console.warn("Could not load cost tracker from Supabase:", err);
    }
  }

  logCost(entry: Omit<CostEntry, "timestamp">) {
    const full = { ...entry, timestamp: Date.now() };
    this.costs.push(full);
    insertCostEntry(full).catch(e => console.error("Failed to persist cost:", e));
  }

  logPinataPinCost(bytes: number) {
    this.pinataFileCount++;
    const wasFree = pinataConfig.plan === "free" && this.pinataBytesUsed <= pinataConfig.storageLimitBytes;
    this.pinataBytesUsed += bytes;
    const isOverLimit = pinataConfig.plan === "free" && this.pinataBytesUsed > pinataConfig.storageLimitBytes;
    const cost = wasFree && !isOverLimit ? 0 : PINATA_OVERAGE.pin;
    this.logCost({ type: "pinata", amount_usd: cost, details: `pinata-pin-${this.pinataFileCount}` });
  }

  logPinataGatewayCost() {
    const isOverLimit = pinataConfig.plan === "free" && this.pinataBytesUsed > pinataConfig.storageLimitBytes;
    const cost = pinataConfig.plan !== "free" ? pinataConfig.gateway
      : isOverLimit ? PINATA_OVERAGE.gateway : 0;
    this.logCost({ type: "pinata", amount_usd: cost, details: "pinata-gateway" });
  }

  getPinataUsage() {
    return {
      bytesUsed: this.pinataBytesUsed,
      fileCount: this.pinataFileCount,
      plan: pinataConfig.plan,
      storageLimitBytes: pinataConfig.storageLimitBytes,
      overLimit: pinataConfig.plan === "free" && this.pinataBytesUsed > pinataConfig.storageLimitBytes,
    };
  }

  logRevenue(entry: Omit<RevenueEntry, "timestamp">) {
    const full = { ...entry, timestamp: Date.now() };
    this.revenues.push(full);
    insertRevenueEntry(full).catch(e => console.error("Failed to persist revenue:", e));
  }

  getUnreimbursedOffchainCosts(): number {
    const totalOffchain = this.costs
      .filter(c => c.type === "openai" || c.type === "pinata")
      .reduce((sum, c) => sum + c.amount_usd, 0);
    const totalReimbursed = this.reimbursements.reduce((sum, r) => sum + r.amount_usd, 0);
    return totalOffchain - totalReimbursed;
  }

  markReimbursed(amount: number, txHash: string) {
    const entry = { amount_usd: amount, txHash, timestamp: Date.now() };
    this.reimbursements.push(entry);
    insertReimbursementEntry(entry).catch(e => console.error("Failed to persist reimbursement:", e));
  }

  getMetricsSnapshot(): Metrics {
    const totalCosts = this.costs.reduce((s, c) => s + c.amount_usd, 0);
    const totalRevenue = this.revenues.reduce((s, r) => s + r.amount_usd, 0);
    const openaiCosts = this.costs.filter(c => c.type === "openai").reduce((s, c) => s + c.amount_usd, 0);
    const gasCosts = this.costs.filter(c => c.type === "gas").reduce((s, c) => s + c.amount_usd, 0);
    const pinataCosts = this.costs.filter(c => c.type === "pinata").reduce((s, c) => s + c.amount_usd, 0);
    const jobProfits = this.revenues.filter(r => r.type === "job_profit").reduce((s, r) => s + r.amount_usd, 0);
    const aiServices = this.revenues.filter(r => r.type === "ai_service").reduce((s, r) => s + r.amount_usd, 0);
    return {
      netProfitUsd: totalRevenue - totalCosts,
      totalRevenueUsd: totalRevenue,
      totalCostsUsd: totalCosts,
      jobsCompleted: this.revenues.filter(r => r.type === "job_profit").length,
      jobsInProgress: 0,
      sustainabilityRatio: totalCosts > 0 ? totalRevenue / totalCosts : 0,
      costBreakdown: { openai: openaiCosts, gas: gasCosts, pinata: pinataCosts, workers: 0 },
      revenueBreakdown: { jobProfits, aiServices, fees: 0 },
      pinataUsage: this.getPinataUsage(),
    };
  }

  getReimbursements() { return this.reimbursements; }

  getProfitDetails(): ProfitDetails {
    const openaiCosts = this.costs.filter(c => c.type === "openai");
    const gasCosts = this.costs.filter(c => c.type === "gas");
    const pinataCosts = this.costs.filter(c => c.type === "pinata");
    const totalRevenue = this.revenues.reduce((s, r) => s + r.amount_usd, 0);
    const totalOpenai = openaiCosts.reduce((s, c) => s + c.amount_usd, 0);
    const totalGas = gasCosts.reduce((s, c) => s + c.amount_usd, 0);
    const totalPinata = pinataCosts.reduce((s, c) => s + c.amount_usd, 0);
    const totalCosts = totalOpenai + totalGas + totalPinata;
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

    // Build Pinata operation lines
    const matchedPinataIds = new Set<number>();
    const pinataLines: OperationLine[] = [];
    for (const op of PINATA_OPS) {
      const matched = pinataCosts.filter((c, i) => {
        if (c.details.startsWith(op.prefix)) { matchedPinataIds.add(i); return true; }
        return false;
      });
      if (matched.length > 0) {
        pinataLines.push({ label: op.label, calls: matched.length, costPerCall: op.costPerCall, totalCost: matched.reduce((s, c) => s + c.amount_usd, 0) });
      }
    }
    const otherPinata = pinataCosts.filter((_, i) => !matchedPinataIds.has(i));
    if (otherPinata.length > 0) {
      const total = otherPinata.reduce((s, c) => s + c.amount_usd, 0);
      pinataLines.push({ label: "Pinata · Other", calls: otherPinata.length, costPerCall: total / otherPinata.length, totalCost: total });
    }
    pinataLines.sort((a, b) => b.totalCost - a.totalCost);

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
      pinataLines,
      revenueLines,
      autonomyMetrics: {
        costCoverageRatio: totalCosts > 0 ? totalRevenue / totalCosts : 0,
        revenuePerJob: jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0,
        costPerJob: jobsCompleted > 0 ? totalCosts / jobsCompleted : 0,
        profitMarginPct: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        openaiAsCostPct: totalCosts > 0 ? (totalOpenai / totalCosts) * 100 : 0,
        gasAsCostPct: totalCosts > 0 ? (totalGas / totalCosts) * 100 : 0,
        pinataAsCostPct: totalCosts > 0 ? (totalPinata / totalCosts) * 100 : 0,
      },
      pnl: { totalRevenue, openaiCosts: totalOpenai, gasCosts: totalGas, pinataCosts: totalPinata, workerCosts: 0, netProfit },
    };
  }
}

export const costTracker = new CostTracker();
