import { useQuery } from "@tanstack/react-query";
import { AGENT_API_URL } from "../config/wagmi";

export interface WorkerProfile {
  wallet_address: string;
  tags: string[];
  updated_at?: string;
}

export function useWorkerProfile(address: string | undefined) {
  return useQuery<WorkerProfile>({
    queryKey: ["workerProfile", address],
    queryFn: async () => {
      const res = await fetch(`${AGENT_API_URL}/api/worker/${address}/profile`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 10_000,
  });
}
