import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { type Metrics } from "./types.js";

interface CostEntry { type: "openai" | "gas"; amount_usd: number; details: string; timestamp: number; }
interface RevenueEntry { type: "job_profit" | "ai_service" | "fee"; amount_usd: number; timestamp: number; }
interface ReimbursementEntry { amount_usd: number; txHash: string; timestamp: number; }

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
