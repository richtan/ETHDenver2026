import { motion } from "framer-motion";
import { Star, Shield, Award } from "lucide-react";
import { formatEther } from "viem";
import type { ReputationTier } from "../hooks/useWorkerReputation";

export const TIER_CONFIG: Record<ReputationTier, { label: string; color: string; bg: string; border: string; icon: typeof Star; bonus: string }> = {
  gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: Star, bonus: "+10%" },
  silver: { label: "Silver", color: "text-zinc-300", bg: "bg-zinc-400/10", border: "border-zinc-400/30", icon: Shield, bonus: "+5%" },
  bronze: { label: "Bronze", color: "text-amber-600", bg: "bg-amber-600/10", border: "border-amber-600/30", icon: Award, bonus: "+2%" },
  none: { label: "Unranked", color: "text-zinc-500", bg: "bg-zinc-700/20", border: "border-zinc-700/40", icon: Shield, bonus: "0%" },
};

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-zinc-400 capitalize">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-emerald-500"
        />
      </div>
      <span className="w-10 text-right text-xs text-zinc-400">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export function ReputationSection({ reputation }: { reputation?: { tasks_completed: number; tasks_rejected: number; reputation_score: number; total_bonus_earned: string; tier: ReputationTier; avg_authenticity: number; avg_relevance: number; avg_completeness: number; avg_quality: number; avg_consistency: number } }) {
  const tier = reputation?.tier ?? "none";
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;
  const hasHistory = (reputation?.tasks_completed ?? 0) + (reputation?.tasks_rejected ?? 0) > 0;

  const bonusEth = reputation?.total_bonus_earned
    ? Number(formatEther(BigInt(reputation.total_bonus_earned))).toFixed(4)
    : "0.0000";

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${cfg.color}`} />
          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-xl ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            {cfg.bonus} bonus
          </span>
        </div>
        {hasHistory && (
          <span className="text-lg font-bold text-white">
            {reputation!.reputation_score.toFixed(2)} <span className="text-sm font-normal text-zinc-400">/ 1.00</span>
          </span>
        )}
      </div>

      {!hasHistory ? (
        <p className="text-sm text-zinc-500">Complete your first task to build your reputation.</p>
      ) : (
        <>
          <div className="flex gap-3 text-xs text-zinc-400">
            <span>{reputation!.tasks_completed} completed</span>
            <span className="text-zinc-600">&middot;</span>
            <span>{reputation!.tasks_rejected} rejected</span>
            <span className="text-zinc-600">&middot;</span>
            <span>{bonusEth} ETH bonuses</span>
          </div>
          <div className="space-y-1.5 pt-1">
            <ScoreBar label="Authenticity" value={reputation!.avg_authenticity} />
            <ScoreBar label="Relevance" value={reputation!.avg_relevance} />
            <ScoreBar label="Completeness" value={reputation!.avg_completeness} />
            <ScoreBar label="Quality" value={reputation!.avg_quality} />
            <ScoreBar label="Consistency" value={reputation!.avg_consistency} />
          </div>
        </>
      )}
    </div>
  );
}
