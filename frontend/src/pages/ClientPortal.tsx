import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Plus,
} from "lucide-react";
import { useCreateJob } from "../hooks/useCreateJob";
import { useClientJobs } from "../hooks/useClientJobs";
import { useJob } from "../hooks/useJob";
import { formatEth } from "../lib/formatEth";

const JOB_STATUS = ["Created", "InProgress", "Completed", "Cancelled"] as const;

function JobCard({ jobId }: { jobId: bigint }) {
  const { job, tasks, isLoading } = useJob(jobId);

  if (isLoading || !job) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5"
      >
        <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading job…</span>
        </div>
      </motion.div>
    );
  }

  const jobData = Array.isArray(job)
    ? {
        description: job[2],
        totalBudget: job[3],
        status: job[7] as number,
      }
    : {
        description: job.description,
        totalBudget: job.totalBudget,
        status: job.status as number,
      };

  const rawTasks = (tasks ?? []) as unknown as Array<{
    id?: bigint;
    sequenceIndex?: number | bigint;
    description?: string;
    status?: number;
  }>;
  const taskList = [...rawTasks].sort((a, b) => {
    const ai = Number(Array.isArray(a) ? a[2] : a.sequenceIndex ?? 0);
    const bi = Number(Array.isArray(b) ? b[2] : b.sequenceIndex ?? 0);
    return ai - bi;
  });
  const completedCount = taskList.filter((t) => (t.status ?? 0) === 4).length;
  const totalCount = taskList.length;
  const statusLabel = JOB_STATUS[Math.min(jobData.status, 3)] ?? "Unknown";

  function getTaskIcon(status: number) {
    switch (status) {
      case 0:
        return <Clock className="h-4 w-4 text-slate-500" />;
      case 1:
        return <ArrowRight className="h-4 w-4 text-amber-400" />;
      case 2:
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 3:
        return <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />;
      case 4:
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 5:
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  }

  const statusBadgeClass = {
    0: "bg-slate-600/30 text-slate-300 border-slate-600/50",
    1: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    2: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    3: "bg-red-500/20 text-red-400 border-red-500/40",
  }[jobData.status] ?? "bg-slate-600/30 text-slate-300";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-slate-300">{jobData.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-blue-400">
              {formatEth(jobData.totalBudget)} ETH
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-slate-500">
              {completedCount}/{totalCount} tasks
            </span>
          </div>
        </div>
      </div>

      {(jobData.status === 0 || jobData.status === 1) && totalCount === 0 && (
        <div className="mt-4 border-t border-slate-800/60 pt-4">
          <div className="flex items-center gap-3 text-blue-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">AI agent is analyzing and decomposing your job...</span>
          </div>
        </div>
      )}

      {taskList.length > 0 && (
        <div className="mt-4 border-t border-slate-800/60 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Task Timeline
          </p>
          <div className="relative flex flex-col gap-0">
            {taskList.map((task, i) => {
              const desc =
                (Array.isArray(task) ? task[4] : task.description) ?? "Task";
              const st = (Array.isArray(task) ? task[12] : task.status) ?? 0;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative flex items-start gap-3"
                >
                  {i < taskList.length - 1 && (
                    <div
                      className="absolute left-[11px] top-6 h-[calc(100%+8px)] w-px bg-slate-700/80"
                      aria-hidden
                    />
                  )}
                  <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800/80">
                    {getTaskIcon(st)}
                  </div>
                  <p className="text-sm text-slate-400">{desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function ClientPortal() {
  const { isConnected } = useAccount();
  const { createJob, isPending, isConfirming, isSuccess } = useCreateJob();
  const { jobIds, isLoading: jobsLoading } = useClientJobs();

  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");

  const budgetNum = parseFloat(budget);
  const canSubmit =
    description.length >= 10 &&
    !isNaN(budgetNum) &&
    budgetNum >= 0.001 &&
    !isPending &&
    !isConfirming;
  const isSubmitting = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      setDescription("");
      setBudget("");
    }
  }, [isSuccess]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createJob(description, budget);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-12"
      >
        <div className="flex items-center gap-2 text-blue-400 mb-3">
          <Zap className="h-6 w-6" />
          <span className="text-sm font-medium uppercase tracking-widest">
            AI Agent Marketplace
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Hire an AI Agent to Get Things Done
        </h1>
        <p className="mt-3 text-lg text-slate-400">
          Submit your job with a budget. An AI agent will break it into tasks and
          coordinate workers on Base.
        </p>
      </motion.section>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-8 text-center"
        >
          <p className="text-slate-400">
            Connect your wallet to create jobs and view your submissions.
          </p>
        </motion.div>
      ) : (
        <>
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="mb-12 rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">
              Submit a New Job
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-400"
                >
                  Job Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you need done. Be specific (min 10 characters)."
                  rows={4}
                  minLength={10}
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {description.length}/10 min characters
                </p>
              </div>
              <div>
                <label
                  htmlFor="budget"
                  className="mb-2 block text-sm font-medium text-slate-400"
                >
                  Budget (ETH)
                </label>
                <input
                  id="budget"
                  type="text"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0.001"
                  min={0.001}
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">Min 0.001 ETH</p>
              </div>
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileHover={canSubmit ? { scale: 1.01 } : {}}
                whileTap={canSubmit ? { scale: 0.99 } : {}}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white shadow-lg shadow-blue-500/25 transition disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-blue-500/40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isConfirming ? "Confirming…" : "Submitting…"}
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Job Created
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Submit Job
                  </>
                )}
              </motion.button>
            </div>
          </motion.form>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Your Jobs
            </h2>
            {jobsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading jobs…</span>
              </div>
            ) : !jobIds?.length ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-12 text-center text-slate-500"
              >
                No jobs yet. Submit your first job above.
              </motion.p>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {jobIds.map((jid) => (
                    <JobCard key={jid.toString()} jobId={jid} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
