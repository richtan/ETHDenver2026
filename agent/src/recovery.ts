import { type Log } from "viem";
import { publicClient } from "./client.js";
import { config } from "./config.js";
import { JOB_MARKETPLACE_ABI } from "./abi.js";
import { completeJobOnChain } from "./actions/marketplace.js";
import { type JobOrchestrator } from "./orchestrator.js";

const MAX_BLOCK_RANGE = 9_999n;

interface JobState {
  description: string;
  budget: bigint;
  tasks: bigint[];
  completed: boolean;
  cancelled: boolean;
}

interface TaskState {
  jobId: bigint;
  proofURI: string;
  proofSubmitted: boolean;
  resolved: boolean;
  completed: boolean;
}

async function getContractEventsChunked() {
  const latestBlock = await publicClient.getBlockNumber();
  const from = config.deploymentBlock;
  const allEvents: Log[] = [];

  for (let start = from; start <= latestBlock; start += MAX_BLOCK_RANGE + 1n) {
    const end = start + MAX_BLOCK_RANGE > latestBlock
      ? latestBlock
      : start + MAX_BLOCK_RANGE;

    const chunk = await publicClient.getContractEvents({
      address: config.contractAddress,
      abi: JOB_MARKETPLACE_ABI,
      fromBlock: start,
      toBlock: end,
    });
    allEvents.push(...(chunk as Log[]));
  }

  return allEvents;
}

export async function recoverState(orchestrator: JobOrchestrator) {
  console.log("Recovering state from on-chain events...");

  const events = await getContractEventsChunked();

  const jobStore = new Map<bigint, JobState>();
  const taskStore = new Map<bigint, TaskState>();

  for (const event of events) {
    const args = event.args as any;
    switch (event.eventName) {
      case "JobCreated":
        jobStore.set(args.jobId, {
          description: args.description,
          budget: args.budget,
          tasks: [],
          completed: false,
          cancelled: false,
        });
        break;
      case "TaskAdded": {
        taskStore.set(args.taskId, {
          jobId: args.jobId,
          proofURI: "",
          proofSubmitted: false,
          resolved: false,
          completed: false,
        });
        const job = jobStore.get(args.jobId);
        if (job) {
          job.tasks.push(args.taskId);
          orchestrator.setJobTaskCount(args.jobId, job.tasks.length);
        }
        break;
      }
      case "ProofSubmitted": {
        const task = taskStore.get(args.taskId);
        if (task) {
          task.proofURI = args.proofURI;
          task.proofSubmitted = true;
        }
        break;
      }
      case "TaskCompleted": {
        const task = taskStore.get(args.taskId);
        if (task) {
          task.resolved = true;
          task.completed = true;
        }
        break;
      }
      case "ProofRejected": {
        const task = taskStore.get(args.taskId);
        if (task) {
          task.resolved = true;
          task.proofSubmitted = false;
        }
        break;
      }
      case "JobCompleted": {
        const job = jobStore.get(args.jobId);
        if (job) job.completed = true;
        break;
      }
      case "JobCancelled": {
        const job = jobStore.get(args.jobId);
        if (job) job.cancelled = true;
        break;
      }
    }
  }

  let recoveredCount = 0;

  for (const [jobId, job] of jobStore) {
    if (job.completed || job.cancelled) continue;

    if (job.tasks.length === 0) {
      console.log(`Recovery: re-decomposing job ${jobId}`);
      await orchestrator.onJobCreated(jobId, job.description, job.budget);
      recoveredCount++;
      continue;
    }

    for (const taskId of job.tasks) {
      const task = taskStore.get(taskId);
      if (task && task.proofSubmitted && !task.resolved) {
        console.log(`Recovery: re-verifying task ${taskId}`);
        await orchestrator.onProofSubmitted(jobId, taskId, task.proofURI);
        recoveredCount++;
      }
    }

    const allDone = job.tasks.length > 0 && job.tasks.every(
      tid => taskStore.get(tid)?.completed
    );
    if (allDone && !job.completed) {
      console.log(`Recovery: completing job ${jobId}`);
      await completeJobOnChain(jobId);
      recoveredCount++;
    }
  }

  console.log(`Recovery complete. Processed ${events.length} events, recovered ${recoveredCount} stuck items.`);
}
