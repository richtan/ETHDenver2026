import { useState, useEffect, useRef } from "react";
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

function allTerminal(tasks: AiTaskResult[]) {
  return (
    tasks.length > 0 &&
    tasks.every((t) => t.status === "completed" || t.status === "failed")
  );
}

const FAST_INTERVAL = 3_000;
const SLOW_INTERVAL = 15_000;

export function useAiTasks(jobId: bigint) {
  const [aiTasks, setAiTasks] = useState<AiTaskResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const settled = useRef(false);
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    settled.current = false;
    hasData.current = false;

    async function poll() {
      if (settled.current) return;
      try {
        const res = await fetch(
          `${AGENT_API_URL}/api/jobs/${jobId.toString()}/ai-tasks`
        );
        if (res.ok) {
          const data: AiTaskResult[] = await res.json();
          if (!cancelled) {
            setAiTasks(data);
            hasData.current = data.length > 0;
            if (allTerminal(data)) settled.current = true;
          }
        }
      } catch {
        // ignore fetch errors
      }
      if (!cancelled) {
        setIsLoading(false);
        if (!settled.current) {
          const delay = hasData.current ? SLOW_INTERVAL : FAST_INTERVAL;
          timer = setTimeout(poll, delay);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  return { aiTasks, isLoading };
}
