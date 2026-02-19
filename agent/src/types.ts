import type { Hash } from "viem";

export interface TaskPlan {
  description: string;
  proofRequirements: string;
  reward: string;
  deadlineMinutes: number;
  dependsOnPrevious: boolean;
  tags: string[];
  executorType: "ai" | "human";
  relevantAiTasks?: number[];
}

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

export interface ParsedTask {
  description: string;
  proofRequirements: string;
  reward: bigint;
  deadlineSeconds: bigint;
  maxRetries: bigint;
}

export interface VerificationScores {
  authenticity: number;
  relevance: number;
  completeness: number;
  quality: number;
  consistency: number;
}

export interface VerifyResult {
  approved: boolean;
  confidence: number;
  scores: VerificationScores;
  reasoning: string;
  suggestion: string;
}

export interface AgentAction {
  type: "job_received" | "job_decomposed" | "task_posted" | "task_accepted"
      | "proof_submitted" | "proof_verified" | "proof_rejected"
      | "worker_paid" | "next_task_opened" | "job_completed"
      | "compute_reimbursed" | "ai_service_sold" | "task_expired" | "job_cancelled"
      | "ai_task_started" | "ai_task_completed";
  jobId?: string;
  taskId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface AgentTransaction {
  action: string;
  hash: Hash;
  amount?: string;
  timestamp: number;
}

export interface Metrics {
  netProfitUsd: number;
  totalRevenueUsd: number;
  totalCostsUsd: number;
  jobsCompleted: number;
  jobsInProgress: number;
  sustainabilityRatio: number;
  costBreakdown: { openai: number; gas: number; workers: number };
  revenueBreakdown: { jobProfits: number; aiServices: number; fees: number };
}
