import { encodeFunctionData, type Hash } from "viem";
import { type AgentWallet } from "../wallet.js";
import { appendBuilderCode } from "../erc8021.js";
import { config } from "../config.js";
import { JOB_MARKETPLACE_ABI } from "../abi.js";
import { type ParsedTask } from "../types.js";

let wallet: AgentWallet;

export function setAgentWallet(w: AgentWallet) {
  wallet = w;
}

async function writeContract(functionName: string, args: readonly unknown[], value?: bigint): Promise<Hash> {
  if (!wallet) throw new Error("AgentWallet not initialized -- call setAgentWallet first");
  const calldata = encodeFunctionData({
    abi: JOB_MARKETPLACE_ABI,
    functionName: functionName as any,
    args: args as any,
  });
  return wallet.sendTransaction({
    to: config.contractAddress,
    data: appendBuilderCode(calldata),
    value: value ?? 0n,
  });
}

export async function createJobOnChain(description: string, budget: bigint): Promise<Hash> {
  return writeContract("createJob", [description], budget);
}

export async function addTaskOnChain(jobId: bigint, task: ParsedTask, _index: number): Promise<Hash> {
  return writeContract("addTask", [
    jobId, task.description, task.proofRequirements,
    task.reward, task.deadlineSeconds, task.maxRetries,
  ]);
}

export async function approveTaskOnChain(jobId: bigint, taskId: bigint): Promise<Hash> {
  return writeContract("approveTask", [jobId, taskId]);
}

export async function completeJobOnChain(jobId: bigint): Promise<Hash> {
  return writeContract("completeJob", [jobId]);
}

export async function rejectProofOnChain(jobId: bigint, taskId: bigint, reason: string): Promise<Hash> {
  return writeContract("rejectProof", [jobId, taskId, reason]);
}

export async function expireTaskOnChain(jobId: bigint, taskId: bigint): Promise<Hash> {
  return writeContract("expireTask", [jobId, taskId]);
}

export async function cancelJobOnChain(jobId: bigint): Promise<Hash> {
  return writeContract("cancelJob", [jobId]);
}
