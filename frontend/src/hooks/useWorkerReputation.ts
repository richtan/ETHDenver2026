import { useQuery } from "@tanstack/react-query";
import { AGENT_API_URL } from "../config/wagmi";

export type ReputationTier = "gold" | "silver" | "bronze" | "none";

export interface WorkerReputation {
  wallet_address: string;
  tasks_completed: number;
  tasks_rejected: number;
  avg_authenticity: number;
  avg_relevance: number;
  avg_completeness: number;
  avg_quality: number;
  avg_consistency: number;
  reputation_score: number;
  total_bonus_earned: string;
  tier: ReputationTier;
}

export function useWorkerReputation(address: string | undefined) {
  return useQuery<WorkerReputation>({
    queryKey: ["workerReputation", address],
    queryFn: async () => {
      const res = await fetch(`${AGENT_API_URL}/api/worker/${address}/reputation`);
      if (!res.ok) throw new Error("Failed to fetch reputation");
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 15_000,
  });
}
