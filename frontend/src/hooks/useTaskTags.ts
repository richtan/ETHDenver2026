import { useQuery } from "@tanstack/react-query";
import { AGENT_API_URL } from "../config/wagmi";

export interface TaskTagEntry {
  task_id: string;
  job_id: string;
  tags: string[];
  created_at: string;
}

export function useTaskTags() {
  return useQuery<TaskTagEntry[]>({
    queryKey: ["taskTags"],
    queryFn: async () => {
      const res = await fetch(`${AGENT_API_URL}/api/tasks/tags`);
      if (!res.ok) throw new Error("Failed to fetch task tags");
      return res.json();
    },
    refetchInterval: 10_000,
  });
}
