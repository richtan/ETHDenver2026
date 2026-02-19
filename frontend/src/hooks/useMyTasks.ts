import { useReadContract, useAccount } from "wagmi";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";

export function useMyTasks() {
  const { address } = useAccount();
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getWorkerTasks",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  return { taskIds: result.data as bigint[] | undefined, isLoading: result.isLoading };
}
