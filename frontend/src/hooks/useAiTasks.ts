import { useState, useEffect } from "react";
import { AGENT_API_URL } from "../config/wagmi";

export interface AiTaskResult {
  id: string;
  job_id: string;
  sequence_index: number;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result: string;
  key_facts: string[];
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

export function useAiTasks(jobId: bigint) {
  const [aiTasks, setAiTasks] = useState<AiTaskResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `${AGENT_API_URL}/api/jobs/${jobId.toString()}/ai-tasks`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAiTasks(data);
        }
      } catch {
        // ignore fetch errors
      }
      if (!cancelled) setIsLoading(false);
    }

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  return { aiTasks, isLoading };
}
