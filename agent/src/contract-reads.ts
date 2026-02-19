import { publicClient } from "./client.js";
import { config } from "./config.js";
import { JOB_MARKETPLACE_ABI } from "./abi.js";

export async function readJobFromContract(jobId: bigint) {
  return publicClient.readContract({
    address: config.contractAddress,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getJob",
    args: [jobId],
  });
}

export async function readTaskFromContract(taskId: bigint) {
  return publicClient.readContract({
    address: config.contractAddress,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getTask",
    args: [taskId],
  });
}

export async function readPreviousDeliverable(jobId: bigint, taskId: bigint): Promise<string> {
  return publicClient.readContract({
    address: config.contractAddress,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getPreviousDeliverable",
    args: [jobId, taskId],
  }) as Promise<string>;
}
