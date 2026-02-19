import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";

export function useAcceptTask() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function acceptTask(jobId: bigint, taskId: bigint) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: JOB_MARKETPLACE_ABI,
      functionName: "acceptTask",
      args: [jobId, taskId],
    });
  }

  return { acceptTask, hash, isPending, isConfirming, isSuccess, error };
}
