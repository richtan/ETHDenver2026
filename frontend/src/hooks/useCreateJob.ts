import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";

export function useCreateJob() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function createJob(description: string, budgetEth: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: JOB_MARKETPLACE_ABI,
      functionName: "createJob",
      args: [description],
      value: parseEther(budgetEth),
    });
  }

  return { createJob, hash, isPending, isConfirming, isSuccess };
}
