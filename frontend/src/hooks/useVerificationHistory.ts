import { useQuery } from "@tanstack/react-query";
import { AGENT_API_URL } from "../config/wagmi";

export interface VerificationRecord {
  id: number;
  wallet_address: string;
  task_id: number;
  job_id: number;
  approved: boolean;
  bonus_wei: string;
  scores: {
    authenticity: number;
    relevance: number;
    completeness: number;
    quality: number;
    consistency: number;
  };
  created_at: string;
}

export function useVerificationHistory(address: string | undefined) {
  return useQuery<VerificationRecord[]>({
    queryKey: ["verificationHistory", address],
    queryFn: async () => {
      const res = await fetch(`${AGENT_API_URL}/api/worker/${address}/history`);
      if (!res.ok) throw new Error("Failed to fetch verification history");
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 15_000,
  });
}
