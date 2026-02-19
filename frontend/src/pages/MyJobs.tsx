import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Briefcase,
  ChevronDown,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Coins,
  ExternalLink,
  ImageIcon,
  Zap,
} from "lucide-react";
import { useClientJobs } from "../hooks/useClientJobs";
import { useJob } from "../hooks/useJob";
import { useAiTasks, type AiTaskResult } from "../hooks/useAiTasks";
import { formatEth } from "../lib/formatEth";
import { ipfsToHttp } from "../config/pinata";

const JOB_STATUS = ["Created", "InProgress", "Completed", "Cancelled"] as const;

type TaskData = {
  id: bigint;
  jobId: bigint;
  sequenceIndex: bigint;
  worker: string;
  description: string;
  proofRequirements: string;
  deliverableURI: string;
  reward: bigint;
  deadline: bigint;
  maxRetries: bigint;
  retryCount: bigint;
  status: number;
  proofURI: string;
  rejectionReason: string;
};

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

const TASK_STATUS_LABEL: Record<number, string> = {
  0: "Pending",
  1: "Open",
  2: "In Progress",
  3: "Verifying",
  4: "Completed",
  5: "Cancelled",
};

function ProofImageGallery({ proofURI }: { proofURI: string }) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const httpUrl = ipfsToHttp(proofURI);
      try {
        const res = await fetch(httpUrl);
        const text = await res.text();
        const json = JSON.parse(text);
        if (json.images && Array.isArray(json.images) && json.images.length > 0) {
          if (!cancelled) setImageUrls(json.images.map((uri: string) => ipfsToHttp(uri)));
        } else {
          if (!cancelled) setImageUrls([httpUrl]);
        }
      } catch {
        if (!cancelled) setImageUrls([httpUrl]);
      }
      if (!cancelled) setLoading(false);
    }
    resolve().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [proofURI]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading proof…
      </div>
    );
  }

  if (error || imageUrls.length === 0) {
    return (
      <div className="py-2 text-xs text-slate-500">
        Unable to load proof.{" "}
        <a
          href={ipfsToHttp(proofURI)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          View raw
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {imageUrls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/30 transition hover:border-slate-600"
        >
          <img
            src={url}
            alt={`Proof ${i + 1}`}
            className="h-24 w-full object-cover transition group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition group-hover:bg-slate-900/30">
            <ExternalLink className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
          </div>
        </a>
      ))}
    </div>
  );
}

function TaskResultRow({ task }: { task: TaskData }) {
  const isCompleted = task.status === 4;
  const hasProof = task.proofURI && task.proofURI.length > 0;

  return (
    <div className="relative flex items-start gap-3 py-2">
      <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800/80">
        {getTaskIcon(task.status)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm text-slate-300 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="m-0">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-slate-200">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => <code className="rounded bg-slate-800/50 px-1 py-0.5 text-xs font-mono text-purple-300">{children}</code>,
                h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-semibold">{children}</h1>,
                h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-1 mb-0.5 text-sm font-semibold">{children}</h3>,
              }}
            >
              {task.description}
            </ReactMarkdown>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-amber-400/80">
              {formatEth(task.reward)} ETH
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </span>
            )}
            {!isCompleted && (
              <span className="text-[10px] text-slate-500">
                {TASK_STATUS_LABEL[task.status] ?? "Unknown"}
              </span>
            )}
          </div>
        </div>

        {task.proofRequirements && (
          <div className="mt-1 text-xs text-slate-500 leading-relaxed prose prose-invert prose-xs max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="m-0">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-slate-400">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => <code className="rounded bg-slate-800/50 px-1 py-0.5 text-[10px] font-mono text-purple-300">{children}</code>,
              }}
            >
              {task.proofRequirements}
            </ReactMarkdown>
          </div>
        )}

        {task.rejectionReason && (
          <p className="mt-1 text-xs text-red-400/80">
            Rejected: {task.rejectionReason}
          </p>
        )}

        {isCompleted && hasProof && <ProofImageGallery proofURI={task.proofURI} />}

        {isCompleted && (
          <Link
            to={`/work/${task.id.toString()}`}
            state={{ from: "/jobs" }}
            className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
          >
            View full details
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function AiTaskRow({ task }: { task: AiTaskResult }) {
  const [showResult, setShowResult] = useState(false);
  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";

  return (
    <div className="relative flex items-start gap-3 py-2">
      <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600/20">
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-purple-400" />
        ) : isFailed ? (
          <XCircle className="h-4 w-4 text-red-400" />
        ) : (
          <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-slate-300">{task.description}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400">
            <Zap className="h-2.5 w-2.5" />
            AI
          </span>
        </div>
        {isCompleted && task.result && (
          <>
            <button
              onClick={() => setShowResult(!showResult)}
              className="mt-1 text-xs text-purple-400 hover:text-purple-300 transition"
            >
              {showResult ? "Hide findings" : "Show findings"}
            </button>
            {showResult && (
              <div className="mt-2 rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 text-xs text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {task.result}
              </div>
            )}
          </>
        )}
        {isFailed && task.error && (
          <p className="mt-1 text-xs text-red-400/80">Error: {task.error}</p>
        )}
      </div>
    </div>
  );
}

function ExpandableJobCard({ jobId }: { jobId: bigint }) {
  const { job, tasks, isLoading } = useJob(jobId);
  const { aiTasks } = useAiTasks(jobId);
  const [expanded, setExpanded] = useState(false);

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
    ? { description: job[2], totalBudget: job[3], status: job[7] as number }
    : { description: job.description, totalBudget: job.totalBudget, status: job.status as number };

  const rawTasks = (tasks ?? []) as unknown as TaskData[];
  const taskList = [...rawTasks].sort(
    (a, b) => Number(a.sequenceIndex ?? 0) - Number(b.sequenceIndex ?? 0),
  );
  const aiCompletedCount = aiTasks.filter((t) => t.status === "completed").length;
  const humanCompletedCount = taskList.filter((t) => t.status === 4).length;
  const completedCount = aiCompletedCount + humanCompletedCount;
  const totalCount = taskList.length + aiTasks.length;
  const statusLabel = JOB_STATUS[Math.min(jobData.status, 3)] ?? "Unknown";

  const statusBadgeClass = {
    0: "bg-slate-600/30 text-slate-300 border-slate-600/50",
    1: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    2: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    3: "bg-red-500/20 text-red-400 border-red-500/40",
  }[jobData.status] ?? "bg-slate-600/30 text-slate-300";

  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden"
    >
      {/* Clickable summary */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-800/20"
      >
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
          {totalCount > 0 && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          )}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="mt-1 shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-slate-500" />
        </motion.div>
      </button>

      {/* Decomposition spinner */}
      {(jobData.status === 0 || jobData.status === 1) && totalCount === 0 && (
        <div className="border-t border-slate-800/60 px-5 py-4">
          <div className="flex items-center gap-3 text-blue-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">AI agent is analyzing and decomposing your job...</span>
          </div>
        </div>
      )}

      {/* Expanded task list */}
      <AnimatePresence>
        {expanded && (aiTasks.length > 0 || taskList.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800/60 px-5 py-4">
              {aiTasks.length > 0 && (
                <>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-purple-400/70">
                    AI Research
                  </p>
                  <div className="space-y-1 mb-4">
                    {aiTasks.map((task, i) => (
                      <div key={task.id} className="relative">
                        {(i < aiTasks.length - 1 || taskList.length > 0) && (
                          <div
                            className="absolute left-[11px] top-8 h-[calc(100%-16px)] w-px bg-purple-700/30"
                            aria-hidden
                          />
                        )}
                        <AiTaskRow task={task} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {taskList.length > 0 && (
                <>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    {aiTasks.length > 0 ? "Human Tasks" : "Tasks"}
                  </p>
                  <div className="space-y-1">
                    {taskList.map((task, i) => (
                      <div key={i} className="relative">
                        {i < taskList.length - 1 && (
                          <div
                            className="absolute left-[11px] top-8 h-[calc(100%-16px)] w-px bg-slate-700/60"
                            aria-hidden
                          />
                        )}
                        <TaskResultRow task={task} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MyJobs() {
  const { isConnected } = useAccount();
  const { jobIds, isLoading } = useClientJobs();

  const ids = jobIds ?? [];
  const hasJobs = ids.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="mb-3 flex items-center gap-2 text-blue-400/90">
          <Briefcase className="h-6 w-6" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Client
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            My Jobs
          </h1>
          {isConnected && !isLoading && (
            <span className="rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-sm font-medium text-slate-300">
              {ids.length} {ids.length === 1 ? "job" : "jobs"}
            </span>
          )}
        </div>
        <p className="mt-3 text-lg text-slate-400">
          Track your posted jobs and view completed results.
        </p>
      </motion.section>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-16 text-center"
        >
          <Briefcase className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-slate-400">
            Connect your wallet to view your jobs.
          </p>
        </motion.div>
      ) : isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-20"
        >
          <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
          <span className="text-lg text-slate-400">Loading your jobs…</span>
        </motion.div>
      ) : !hasJobs ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-16 text-center"
        >
          <ImageIcon className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">No jobs yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Post your first job to get started.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500/80 hover:bg-slate-800/80 hover:text-white"
          >
            <Briefcase className="h-4 w-4" />
            Post a Job
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {ids.map((jid) => (
              <ExpandableJobCard key={jid.toString()} jobId={jid} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
