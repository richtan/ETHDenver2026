import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";

export function useJob(jobId: bigint) {
  const job = useReadContract({
    address: CONTRACT_ADDRESS, abi: JOB_MARKETPLACE_ABI,
    functionName: "getJob", args: [jobId],
    query: { refetchInterval: 10_000 },
  });

  const jobStatus = useMemo(() => {
    if (!job.data) return undefined;
    const d = job.data as any;
    return (Array.isArray(d) ? d[7] : d.status) as number | undefined;
  }, [job.data]);

  const isTerminal = jobStatus === 2 || jobStatus === 3;

  const tasks = useReadContract({
    address: CONTRACT_ADDRESS, abi: JOB_MARKETPLACE_ABI,
    functionName: "getJobTasks", args: [jobId],
    query: { refetchInterval: isTerminal ? false : 10_000 },
  });
  return { job: job.data, tasks: tasks.data, isLoading: job.isLoading || tasks.isLoading };
}
