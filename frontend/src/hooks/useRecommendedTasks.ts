import { useQuery } from "@tanstack/react-query";
import { AGENT_API_URL } from "../config/wagmi";

export interface TaskRecommendation {
  taskId: string;
  score: number;
  matchedTags: string[];
}

export function useRecommendedTasks(
  address: string | undefined,
  openTaskIds: string[],
) {
  return useQuery<TaskRecommendation[]>({
    queryKey: ["recommendedTasks", address, openTaskIds.join(",")],
    queryFn: async () => {
      const ids = openTaskIds.join(",");
      const res = await fetch(
        `${AGENT_API_URL}/api/tasks/recommended/${address}?taskIds=${ids}`,
      );
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!address && openTaskIds.length > 0,
    refetchInterval: 5_000,
  });
}
