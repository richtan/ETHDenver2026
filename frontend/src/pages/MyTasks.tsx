import { Link } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ArrowRight,
  Clock,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";
import { formatEth } from "../lib/formatEth";
import { useMyTasks } from "../hooks/useMyTasks";

const TASK_STATUS = {
  0: { label: "Pending", color: "text-slate-400 bg-slate-800/50", icon: Clock },
  1: { label: "Open", color: "text-blue-400 bg-blue-500/20", icon: Clock },
  2: { label: "In Progress", color: "text-amber-400 bg-amber-500/20", icon: CheckCircle2 },
  3: { label: "Pending Verification", color: "text-cyan-400 bg-cyan-500/20", icon: Loader2 },
  4: { label: "Completed", color: "text-emerald-400 bg-emerald-500/20", icon: CheckCircle2 },
  5: { label: "Cancelled", color: "text-red-400 bg-red-500/20", icon: ExternalLink },
} as const;

function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}

type TaskData = {
  id: bigint;
  jobId: bigint;
  sequenceIndex: bigint;
  worker: `0x${string}`;
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

function TaskRow({ taskId }: { taskId: bigint }) {
  const { data: task, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getTask",
    args: [taskId],
  });

  const parsedTask = task as TaskData | undefined;
  const statusMeta = parsedTask
    ? (TASK_STATUS[parsedTask.status as keyof typeof TASK_STATUS] ?? TASK_STATUS[0])
    : null;
  const StatusIcon = statusMeta?.icon ?? Clock;

  if (isLoading) {
    return (
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 backdrop-blur-sm"
      >
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-700/50" />
        <div className="mb-4 h-5 w-full animate-pulse rounded bg-slate-700/50" />
        <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-slate-700/40" />
        <div className="flex items-center gap-3">
          <div className="h-5 w-20 animate-pulse rounded bg-slate-700/40" />
          <div className="h-5 w-28 animate-pulse rounded bg-slate-700/40" />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-700/50" />
        </div>
      </motion.article>
    );
  }

  if (!parsedTask) {
    return null;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 backdrop-blur-sm transition-colors hover:border-slate-700/80 hover:bg-slate-900/60"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-2.5 py-1 text-xs font-medium ${statusMeta?.color}`}
        >
          {parsedTask.status === 3 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <StatusIcon className="h-3.5 w-3.5" />
          )}
          {statusMeta?.label ?? "Unknown"}
        </span>
        <span className="text-xs text-slate-500">Task #{parsedTask.id.toString()}</span>
      </div>

      <p className="text-slate-300 line-clamp-2 min-h-[2.5rem]">
        {truncate(parsedTask.description)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400">
          <Clock className="h-4 w-4" />
          {formatEth(parsedTask.reward)} ETH
        </span>
      </div>

      <Link
        to={`/work/${parsedTask.id.toString()}`}
        state={{ from: "/my-tasks" }}
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500/80 hover:bg-slate-800/80 hover:text-white group/link"
      >
        View details
        <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" />
      </Link>
    </motion.article>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export default function MyTasks() {
  const { isConnected } = useAccount();
  const { taskIds, isLoading } = useMyTasks();

  const ids = taskIds ?? [];
  const hasTasks = ids.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="mb-3 flex items-center gap-2 text-amber-400/90">
          <User className="h-6 w-6" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Worker
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            My Work
          </h1>
          {isConnected && !isLoading && (
            <span className="rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-sm font-medium text-slate-300">
              {ids.length} {ids.length === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>
        <p className="mt-3 text-lg text-slate-400">
          View your accepted and completed work on the TaskMaster marketplace.
        </p>
      </motion.section>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-16 text-center"
        >
          <User className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-slate-400">
            Connect your wallet to view your tasks.
          </p>
        </motion.div>
      ) : isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-20"
        >
          <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
          <span className="text-lg text-slate-400">Loading your tasks…</span>
        </motion.div>
      ) : !hasTasks ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-16 text-center"
        >
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">
            No tasks yet
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Accept tasks from the marketplace to see them here.
          </p>
          <Link
            to="/work"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500/80 hover:bg-slate-800/80 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Browse marketplace
          </Link>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {ids.map((taskId) => (
              <TaskRow key={taskId.toString()} taskId={taskId} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
