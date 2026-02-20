import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Activity,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  ExternalLink,
  Zap,
  Clock,
  Circle,
  AlertCircle,
  BarChart2,
  Cpu,
  Flame,
  HardDrive,
} from "lucide-react";
import { useAgentStream } from "../hooks/useAgentStream";
import type { AgentAction, AgentTransaction, ProfitDetails, OperationLine, PinataUsage } from "../hooks/useAgentStream";
import { truncateAddress, formatUsd } from "../lib/formatEth";
import { useEthPrice } from "../hooks/useEthPrice";

const EXPLORER = "https://basescan.org/tx/";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ACTION_COLORS: Record<string, string> = {
  job_received: "bg-cyan-400",
  job_decomposed: "bg-blue-400",
  task_posted: "bg-cyan-500",
  task_accepted: "bg-indigo-400",
  proof_submitted: "bg-violet-400",
  proof_verified: "bg-emerald-400",
  proof_rejected: "bg-red-400",
  worker_paid: "bg-amber-400",
  next_task_opened: "bg-blue-300",
  job_completed: "bg-purple-400",
  compute_reimbursed: "bg-orange-400",
  ai_service_sold: "bg-teal-400",
  clarification_round: "bg-sky-400",
  ipfs_upload: "bg-pink-400",
};

const ACTION_GLOW: Record<string, string> = {
  job_received: "shadow-cyan-400/40",
  job_decomposed: "shadow-blue-400/40",
  task_posted: "shadow-cyan-500/40",
  proof_verified: "shadow-emerald-400/40",
  proof_rejected: "shadow-red-400/40",
  worker_paid: "shadow-amber-400/40",
  job_completed: "shadow-purple-400/40",
  clarification_round: "shadow-sky-400/40",
  ipfs_upload: "shadow-pink-400/40",
};

function ethToUsdStr(ethAmount: string | undefined, ethPrice: number | null): string {
  if (!ethAmount || !ethPrice) return "";
  const usd = parseFloat(ethAmount) * ethPrice;
  return isNaN(usd) ? "" : ` (~${formatUsd(usd)})`;
}

function actionMessage(a: AgentAction, ethPrice: number | null): string {
  switch (a.type) {
    case "job_received":
      return `New job received: '${a.description ?? "Untitled"}'`;
    case "job_decomposed":
      return `Decomposed job #${a.jobId} into ${a.taskCount ?? "?"} tasks. Margin: ${a.margin ?? "?"} ETH${ethToUsdStr(a.margin, ethPrice)}`;
    case "task_posted":
      return `Posted task: '${a.description ?? "Untitled"}' — ${a.reward ?? "?"} ETH${ethToUsdStr(a.reward, ethPrice)}`;
    case "task_accepted":
      return `Worker ${a.worker ? truncateAddress(a.worker) : "unknown"} accepted task #${a.taskId}`;
    case "proof_submitted":
      return `Proof submitted for task #${a.taskId}`;
    case "proof_verified":
      return `Proof verified — confidence: ${a.confidence ?? "?"}%`;
    case "proof_rejected":
      return `Proof rejected: '${a.reason ?? "Unknown reason"}'`;
    case "worker_paid":
      return `Paid worker ${a.amount ?? "?"} ETH${ethToUsdStr(a.amount, ethPrice)}`;
    case "next_task_opened":
      return `Next task opened for job #${a.jobId}`;
    case "job_completed":
      return `Job #${a.jobId} complete! Profit: ${a.profit ?? "?"} ETH${ethToUsdStr(a.profit, ethPrice)}`;
    case "compute_reimbursed":
      return `Reimbursed $${a.amount_usd ?? "?"} compute`;
    case "ai_service_sold":
      return `AI service sold: ${a.service ?? "Unknown"}`;
    case "clarification_round":
      return `Clarifying job requirements (round ${(a.round ?? 0) + 1})${a.ready ? " — ready to create" : ""}`;
    case "ipfs_upload": {
      const fc = a.fileCount ?? 1;
      const sizeStr = a.totalBytes ? ` — ${formatBytes(a.totalBytes)}` : "";
      return `Uploaded proof to IPFS (${fc} file${fc > 1 ? "s" : ""}${sizeStr})`;
    }
    default:
      return a.type.replace(/_/g, " ");
  }
}

function MetricCard({
  label,
  value,
  prefix,
  icon: Icon,
  color,
  idx,
}: {
  label: string;
  value: string | number | null;
  prefix?: string;
  icon: React.ElementType;
  color: string;
  idx: number;
}) {
  const colorMap: Record<string, { border: string; iconBg: string; iconText: string; value: string }> = {
    emerald: {
      border: "border-emerald-500/20",
      iconBg: "bg-emerald-500/10",
      iconText: "text-emerald-400",
      value: "text-emerald-400",
    },
    blue: {
      border: "border-blue-500/20",
      iconBg: "bg-blue-500/10",
      iconText: "text-blue-400",
      value: "text-white",
    },
    indigo: {
      border: "border-indigo-500/20",
      iconBg: "bg-indigo-500/10",
      iconText: "text-indigo-400",
      value: "text-white",
    },
    red: {
      border: "border-red-500/20",
      iconBg: "bg-red-500/10",
      iconText: "text-red-400",
      value: "text-red-400",
    },
  };
  const c = colorMap[color] ?? colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + idx * 0.07, duration: 0.45 }}
      className={`relative overflow-hidden rounded-xl border ${c.border} bg-slate-900/40 p-5`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
          <Icon className={`h-4 w-4 ${c.iconText}`} />
        </div>
      </div>
      <motion.p
        key={String(value)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`text-2xl font-bold tracking-tight ${c.value}`}
      >
        {value != null ? `${prefix ?? ""}${typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}` : "—"}
      </motion.p>
    </motion.div>
  );
}

function BreakdownBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-300">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

// ── New: P&L + Self-Sufficiency Panel ────────────────────────────

function PnlRow({ label, amount, sign, isTotal }: { label: string; amount: number; sign: "+" | "-" | "="; isTotal?: boolean }) {
  const signColor = sign === "+" ? "text-emerald-400" : sign === "-" ? "text-red-400" : amount >= 0 ? "text-emerald-400" : "text-red-400";
  return (
    <div className={`flex items-center justify-between py-1.5 ${isTotal ? "border-t border-slate-700/60 mt-1 pt-2.5" : ""}`}>
      <span className={`text-sm ${isTotal ? "font-semibold text-white" : "text-slate-400"}`}>{label}</span>
      <span className={`font-mono text-sm font-semibold ${signColor}`}>
        {sign !== "=" ? sign : amount >= 0 ? "+" : ""}{formatUsd(Math.abs(amount))}
      </span>
    </div>
  );
}

function AutonMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-800/30 px-3 py-2.5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PnlPanel({ details }: { details: ProfitDetails | null }) {
  const am = details?.autonomyMetrics;
  const pnl = details?.pnl;
  const na = "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.45 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* P&L Waterfall */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Profit & Loss</h3>
        </div>
        {pnl ? (
          <div>
            <PnlRow label="Total Revenue" amount={pnl.totalRevenue} sign="+" />
            <PnlRow label="OpenAI API Costs" amount={pnl.openaiCosts} sign="-" />
            <PnlRow label="Gas Costs" amount={pnl.gasCosts} sign="-" />
            <PnlRow label="Pinata IPFS Costs" amount={pnl.pinataCosts} sign="-" />
            {pnl.workerCosts > 0 && <PnlRow label="Worker Costs" amount={pnl.workerCosts} sign="-" />}
            <PnlRow label="Net Profit" amount={pnl.netProfit} sign="=" isTotal />
          </div>
        ) : (
          <p className="text-sm text-slate-600 py-4 text-center">Awaiting data…</p>
        )}
      </div>

      {/* Self-Sufficiency Metrics */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Self-Sufficiency Metrics</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AutonMetric
            label="Cost Coverage Ratio"
            value={am ? `${am.costCoverageRatio.toFixed(2)}x` : na}
          />
          <AutonMetric
            label="Revenue per Job"
            value={am && am.revenuePerJob > 0 ? formatUsd(am.revenuePerJob) : na}
          />
          <AutonMetric
            label="Cost per Job"
            value={am && am.costPerJob > 0 ? formatUsd(am.costPerJob) : na}
          />
          <AutonMetric
            label="Profit Margin"
            value={am && details?.pnl.totalRevenue ? `${am.profitMarginPct.toFixed(1)}%` : na}
          />
          <AutonMetric
            label="OpenAI % of Costs"
            value={am ? `${am.openaiAsCostPct.toFixed(1)}%` : na}
          />
          <AutonMetric
            label="Gas % of Costs"
            value={am ? `${am.gasAsCostPct.toFixed(1)}%` : na}
          />
          <AutonMetric
            label="Pinata % of Costs"
            value={am ? `${am.pinataAsCostPct.toFixed(1)}%` : na}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── New: Operation Cost Table ─────────────────────────────────────

function OperationCostTable({
  title,
  icon: Icon,
  lines,
  totalCost,
  accentColor,
  delay = 0,
}: {
  title: string;
  icon: React.ElementType;
  lines: OperationLine[];
  totalCost: number;
  accentColor: "orange" | "red" | "pink";
  delay?: number;
}) {
  const colorMap = {
    orange: { header: "text-orange-400", badge: "bg-orange-500/10 text-orange-400", bar: "bg-gradient-to-r from-orange-500 to-amber-400" },
    red:    { header: "text-red-400",    badge: "bg-red-500/10 text-red-400",       bar: "bg-gradient-to-r from-red-500 to-rose-400" },
    pink:   { header: "text-pink-400",   badge: "bg-pink-500/10 text-pink-400",     bar: "bg-gradient-to-r from-pink-500 to-fuchsia-400" },
  };
  const { header: headerColor, badge: badgeColor, bar: barColor } = colorMap[accentColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-5 py-3.5">
        <Icon className={`h-4 w-4 ${headerColor}`} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold ${badgeColor}`}>
          {formatUsd(totalCost)} total
        </span>
      </div>

      {lines.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-slate-600">
          No costs tracked yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/40 text-xs uppercase tracking-wider text-slate-600">
                <th className="px-5 py-2.5 font-medium">Operation</th>
                <th className="py-2.5 font-medium text-right pr-4">Calls</th>
                <th className="py-2.5 font-medium text-right pr-4">/Call</th>
                <th className="py-2.5 font-medium text-right pr-5">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const pct = totalCost > 0 ? (line.totalCost / totalCost) * 100 : 0;
                return (
                  <motion.tr
                    key={line.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.05 * i, duration: 0.3 }}
                    className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="text-sm text-slate-200 mb-1">{line.label}</div>
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-sm text-slate-300 text-right">
                      {line.calls}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500 text-right">
                      {formatUsd(line.costPerCall)}
                    </td>
                    <td className="py-3 pr-5 font-mono text-sm font-semibold text-slate-200 text-right">
                      {formatUsd(line.totalCost)}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ── Pinata Usage Gauge ────────────────────────────────────────────

function PinataUsageGauge({ usage }: { usage: PinataUsage | undefined }) {
  if (!usage) return null;
  const pct = usage.storageLimitBytes > 0
    ? Math.min((usage.bytesUsed / usage.storageLimitBytes) * 100, 100)
    : 0;
  const planLabel = usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1);
  const barColor = usage.overLimit
    ? "bg-gradient-to-r from-red-500 to-orange-400"
    : pct > 80
      ? "bg-gradient-to-r from-amber-500 to-yellow-400"
      : "bg-gradient-to-r from-pink-500 to-fuchsia-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.45 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-pink-400" />
          <h3 className="text-sm font-semibold text-white">Pinata IPFS Storage</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-pink-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-pink-400">
            {planLabel} Plan
          </span>
          {usage.overLimit && (
            <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
              OVER LIMIT
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-lg font-bold text-white">
            {formatBytes(usage.bytesUsed)}
          </span>
          <span className="text-xs text-slate-500">
            of {formatBytes(usage.storageLimitBytes)}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{usage.fileCount} file{usage.fileCount !== 1 ? "s" : ""} pinned</span>
          <span className="font-mono">{pct.toFixed(1)}%</span>
        </div>
        {usage.overLimit && (
          <p className="text-xs text-amber-400 mt-1">
            Free tier limit exceeded — uploads now billed at Picnic tier rates ($0.02/pin)
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── New: Revenue Detail Panel ─────────────────────────────────────

function RevenueDetailPanel({ details }: { details: ProfitDetails | null }) {
  const lines = details?.revenueLines ?? [];
  const total = lines.reduce((s, l) => s + l.amount, 0);

  const colors = [
    { bar: "bg-gradient-to-r from-emerald-500 to-green-400", badge: "bg-emerald-500/10 text-emerald-400" },
    { bar: "bg-gradient-to-r from-blue-500 to-cyan-400", badge: "bg-blue-500/10 text-blue-400" },
    { bar: "bg-gradient-to-r from-indigo-500 to-violet-400", badge: "bg-indigo-500/10 text-indigo-400" },
  ];

  // When no revenue yet, show placeholder cards
  const displayLines = lines.length > 0 ? lines : [
    { label: "Job Completions", amount: 0, count: 0 },
    { label: "AI Services Sold", amount: 0, count: 0 },
    { label: "Protocol Fees", amount: 0, count: 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.45 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-5 py-3.5">
        <Flame className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Revenue Breakdown</h3>
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-emerald-400">
          {formatUsd(total)} total
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60">
        {displayLines.map((line, i) => {
          const pct = total > 0 ? (line.amount / total) * 100 : 0;
          const c = colors[i % colors.length];
          return (
            <div key={line.label} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{line.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-mono ${c.badge}`}>
                  {line.count} txns
                </span>
              </div>
              <p className="font-mono text-xl font-bold text-white">{formatUsd(line.amount)}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>of total</span>
                  <span className="font-mono">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 + i * 0.1 }}
                    className={`h-full rounded-full ${c.bar}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function AgentDashboard() {
  const { actions, metrics, transactions, profitDetails, connected } = useAgentStream();
  const { ethPrice } = useEthPrice();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [actions.length]);

  const costTotal = metrics
    ? metrics.costBreakdown.openai + metrics.costBreakdown.gas + metrics.costBreakdown.pinata + metrics.costBreakdown.workers
    : 0;
  const revTotal = metrics
    ? metrics.revenueBreakdown.jobProfits + metrics.revenueBreakdown.aiServices + metrics.revenueBreakdown.fees
    : 0;

  const costPct = (v: number) => (costTotal > 0 ? (v / costTotal) * 100 : 0);
  const revPct = (v: number) => (revTotal > 0 ? (v / revTotal) * 100 : 0);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">TaskMaster Agent</h1>
            <p className="text-xs text-slate-500">Autonomous AI workforce coordinator</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {connected ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-400">
              <AlertCircle className="h-3 w-3" />
              Reconnecting…
            </span>
          )}
          <span className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-mono text-slate-400">
            SSE Stream
          </span>
        </div>
      </motion.div>

      {/* ── Two-column grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Live Activity Feed (3/5 = 60%) */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-3 flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-5 py-4">
            <Activity className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Live Activity Feed</h2>
            <span className="ml-auto rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-mono text-blue-400">
              {actions.length}
            </span>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto max-h-[620px] p-2">
            {actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                <Zap className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm">Waiting for agent activity…</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {actions.map((a, i) => {
                  const dotColor = ACTION_COLORS[a.type] ?? "bg-slate-500";
                  const glow = ACTION_GLOW[a.type] ?? "";
                  return (
                    <motion.div
                      key={`${a.timestamp}-${a.type}-${i}`}
                      initial={{ opacity: 0, y: -20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="group relative flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-slate-800/30"
                    >
                      {/* Timeline spine */}
                      {i < actions.length - 1 && (
                        <div className="absolute left-[21px] top-9 bottom-0 w-px bg-linear-to-b from-slate-700/60 to-transparent" />
                      )}

                      <div className="relative mt-0.5 shrink-0">
                        <span
                          className={`block h-3 w-3 rounded-full ${dotColor} ${glow ? `shadow-md ${glow}` : ""} ring-2 ring-slate-900/80`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug text-slate-200">
                          {actionMessage(a, ethPrice)}
                        </p>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Clock className="h-3 w-3" />
                            {timeAgo(a.timestamp)}
                          </span>
                          {a.hash && (
                            <a
                              href={`${EXPLORER}${a.hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
                            >
                              tx {truncateAddress(a.hash)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* RIGHT COLUMN (2/5 = 40%) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* A. Key Metrics Cards */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Net Profit"
                value={metrics?.netProfitUsd ?? null}
                prefix="$"
                icon={TrendingUp}
                color={metrics && metrics.netProfitUsd >= 0 ? "emerald" : "red"}
                idx={0}
              />
              <MetricCard
                label="Jobs Done"
                value={metrics ? String(metrics.jobsCompleted) : null}
                icon={CheckCircle2}
                color="blue"
                idx={1}
              />
              <MetricCard
                label="Revenue"
                value={metrics?.totalRevenueUsd ?? null}
                prefix="$"
                icon={DollarSign}
                color="indigo"
                idx={2}
              />
              <MetricCard
                label="Costs"
                value={metrics?.totalCostsUsd ?? null}
                prefix="$"
                icon={Zap}
                color="red"
                idx={3}
              />
            </div>

            {/* Sustainability badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-2.5"
            >
              {metrics ? (
                metrics.sustainabilityRatio >= 1 ? (
                  <>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-xs">
                      ✓
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">SUSTAINABLE</span>
                    <span className="text-xs text-slate-500 font-mono ml-1">
                      {metrics.sustainabilityRatio.toFixed(2)}x
                    </span>
                  </>
                ) : (
                  <>
                    <Circle className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">SCALING UP</span>
                    <span className="text-xs text-slate-500 font-mono ml-1">
                      {metrics.sustainabilityRatio.toFixed(2)}x
                    </span>
                  </>
                )
              ) : (
                <span className="text-xs text-slate-600">Awaiting metrics…</span>
              )}
            </motion.div>
          </div>

          {/* B. Transaction History */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.45 }}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-5 py-3.5">
              <DollarSign className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Transactions</h2>
              <span className="ml-auto rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-mono text-indigo-400">
                {transactions.length}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-sm text-slate-600">
                  No transactions yet
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-xs uppercase tracking-wider text-slate-600">
                      <th className="px-5 py-2.5 font-medium">Time</th>
                      <th className="py-2.5 font-medium">Action</th>
                      <th className="py-2.5 font-medium">Amount</th>
                      <th className="py-2.5 font-medium">TX</th>
                    </tr>
                  </thead>
                  <tbody className="px-5">
                    {transactions.map((tx, i) => (
                      <tr
                        key={`${tx.hash}-${i}`}
                        className="border-b border-slate-800/30 text-sm transition-colors hover:bg-slate-800/20"
                      >
                        <td className="py-2.5 pl-5 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {timeAgo(tx.timestamp)}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-300 capitalize">
                          {tx.action.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-slate-200">
                          {tx.amount ? <>{tx.amount} ETH<span className="text-slate-500 text-xs">{ethToUsdStr(tx.amount, ethPrice)}</span></> : "—"}
                        </td>
                        <td className="py-2.5 pr-5 font-mono text-xs">
                          {tx.hash ? (
                            <a
                              href={`${EXPLORER}${tx.hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {truncateAddress(tx.hash)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>

          {/* C. Cost / Revenue Breakdown (quick-glance % bars) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
            className="grid grid-cols-2 gap-3"
          >
            {/* Costs */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-red-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Costs</h3>
              </div>
              {metrics ? (
                <>
                  <BreakdownBar label="OpenAI" pct={costPct(metrics.costBreakdown.openai)} color="bg-gradient-to-r from-orange-500 to-amber-400" />
                  <BreakdownBar label="Gas" pct={costPct(metrics.costBreakdown.gas)} color="bg-gradient-to-r from-red-500 to-rose-400" />
                  <BreakdownBar label="Pinata" pct={costPct(metrics.costBreakdown.pinata)} color="bg-gradient-to-r from-pink-500 to-fuchsia-400" />
                  <BreakdownBar label="Workers" pct={costPct(metrics.costBreakdown.workers)} color="bg-gradient-to-r from-violet-500 to-purple-400" />
                </>
              ) : (
                <p className="text-xs text-slate-600 py-2">—</p>
              )}
            </div>

            {/* Revenue */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</h3>
              </div>
              {metrics ? (
                <>
                  <BreakdownBar label="Jobs" pct={revPct(metrics.revenueBreakdown.jobProfits)} color="bg-gradient-to-r from-emerald-500 to-green-400" />
                  <BreakdownBar label="AI Services" pct={revPct(metrics.revenueBreakdown.aiServices)} color="bg-gradient-to-r from-blue-500 to-cyan-400" />
                  <BreakdownBar label="Fees" pct={revPct(metrics.revenueBreakdown.fees)} color="bg-gradient-to-r from-indigo-500 to-violet-400" />
                </>
              ) : (
                <p className="text-xs text-slate-600 py-2">—</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── P&L + Self-Sufficiency ───────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <BarChart2 className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Financial Deep Dive</h2>
        <div className="flex-1 h-px bg-slate-800/60" />
      </div>

      <PnlPanel details={profitDetails} />

      {/* ── API Cost Tables ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OperationCostTable
          title="OpenAI API Costs"
          icon={Zap}
          lines={profitDetails?.openaiLines ?? []}
          totalCost={profitDetails?.pnl.openaiCosts ?? 0}
          accentColor="orange"
          delay={0.25}
        />
        <OperationCostTable
          title="Gas Costs"
          icon={Activity}
          lines={profitDetails?.gasLines ?? []}
          totalCost={profitDetails?.pnl.gasCosts ?? 0}
          accentColor="red"
          delay={0.3}
        />
        <OperationCostTable
          title="Pinata IPFS Costs"
          icon={HardDrive}
          lines={profitDetails?.pinataLines ?? []}
          totalCost={profitDetails?.pnl.pinataCosts ?? 0}
          accentColor="pink"
          delay={0.35}
        />
      </div>

      {/* ── Pinata Storage Usage ─────────────────────────── */}
      <PinataUsageGauge usage={metrics?.pinataUsage} />

      {/* ── Revenue Detail ───────────────────────────────── */}
      <RevenueDetailPanel details={profitDetails} />
    </div>
  );
}
