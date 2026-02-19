import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";

export function useJob(jobId: bigint) {
  const job = useReadContract({
    address: CONTRACT_ADDRESS, abi: JOB_MARKETPLACE_ABI,
    functionName: "getJob", args: [jobId],
    query: { refetchInterval: 10_000 },
  });
  const tasks = useReadContract({
    address: CONTRACT_ADDRESS, abi: JOB_MARKETPLACE_ABI,
    functionName: "getJobTasks", args: [jobId],
    query: { refetchInterval: 10_000 },
  });
  return { job: job.data, tasks: tasks.data, isLoading: job.isLoading || tasks.isLoading };
}
