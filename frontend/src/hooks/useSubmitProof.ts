import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";

export function useSubmitProof() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function submitProof(jobId: bigint, taskId: bigint, proofURI: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: JOB_MARKETPLACE_ABI,
      functionName: "submitProof",
      args: [jobId, taskId, proofURI],
    });
  }

  return { submitProof, hash, isPending, isConfirming, isSuccess };
}
