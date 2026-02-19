import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Coins,
  Hammer,
  ArrowRight,
  Loader2,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useOpenTasks } from '../hooks/useOpenTasks';
import { useAcceptTask } from '../hooks/useAcceptTask';
import { useJob } from '../hooks/useJob';
import { formatEth } from '../lib/formatEth';

/** Decoded task from getOpenTasks (wagmi/viem returns structs as objects) */
type TaskStruct = {
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

function truncate(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '…';
}

function formatDeadline(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  if (deadlineNum <= now) return 'Expired';
  return `${formatDistanceToNow(new Date(deadlineNum * 1000), { addSuffix: true })}`;
}

function JobContextBadge({ jobId }: { jobId: bigint }) {
  const { job, isLoading } = useJob(jobId);

  if (isLoading || !job) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-xs text-slate-500">
        <Briefcase className="h-3.5 w-3.5" />
        Job #{jobId.toString()}
      </span>
    );
  }

  const desc = Array.isArray(job) ? job[2] : job.description;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-xs text-slate-400"
      title={desc}
    >
      <Briefcase className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[120px]">{truncate(desc, 25)}</span>
    </span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

function TaskCard({
  task,
  isAccepting,
  onAccept,
  canAccept,
}: {
  task: TaskStruct;
  isAccepting: boolean;
  onAccept: () => void;
  canAccept: boolean;
}) {
  const { id, jobId, description, reward, deadline } = task;
  const deadlineStr = formatDeadline(deadline);
  const isExpired = deadlineStr === 'Expired';

  return (
    <motion.article
      variants={cardVariants}
      className="group relative flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 backdrop-blur-sm transition-colors hover:border-slate-700/80 hover:bg-slate-900/60"
    >
      <div className="mb-3">
        <JobContextBadge jobId={jobId} />
      </div>

      <p className="text-slate-300 line-clamp-3 min-h-[4.5rem]">
        {truncate(description)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400">
          <Coins className="h-4 w-4" />
          {formatEth(reward)} ETH
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-sm ${
            isExpired ? 'text-red-400/90' : 'text-slate-400'
          }`}
        >
          <Clock className="h-4 w-4 shrink-0" />
          {deadlineStr}
        </span>
      </div>

      <div className="mt-5 flex flex-1 items-end gap-2">
        <Link
          to={`/work/${id.toString()}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500/80 hover:bg-slate-800/80 hover:text-white"
        >
          View Details
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onAccept}
          disabled={!canAccept || isExpired || isAccepting}
          className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-emerald-500/20"
        >
          {isAccepting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Accepting…
            </>
          ) : (
            <>
              <Hammer className="h-4 w-4" />
              Accept
            </>
          )}
        </button>
      </div>
    </motion.article>
  );
}

export default function WorkerMarketplace() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const { data: tasks, isLoading: tasksLoading } = useOpenTasks();
  const { acceptTask, isPending, isConfirming, isSuccess, error } =
    useAcceptTask();

  const [acceptingTaskId, setAcceptingTaskId] = useState<bigint | null>(null);
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<bigint>>(new Set());
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuccess || acceptingTaskId === null) return;
    setHiddenTaskIds((prev) => new Set(prev).add(acceptingTaskId));
    setSuccessBanner(`Task #${acceptingTaskId.toString()} accepted!`);
    const navTimer = setTimeout(() => {
      navigate(`/work/${acceptingTaskId.toString()}`);
    }, 1500);
    return () => clearTimeout(navTimer);
  }, [isSuccess, acceptingTaskId, navigate]);

  const taskList: TaskStruct[] = Array.isArray(tasks)
    ? tasks.filter(
        (t): t is TaskStruct =>
          t != null && typeof t === 'object' && 'id' in t && 'jobId' in t &&
          !hiddenTaskIds.has(t.id)
      )
    : [];
  const canAccept = isConnected && !isPending && !isConfirming;
  const isAccepting = isPending || isConfirming;

  return (
    <div className="mx-auto max-w-6xl">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 text-emerald-400/90 mb-3">
          <Hammer className="h-6 w-6" />
          <span className="text-sm font-medium uppercase tracking-widest">
            Task Marketplace
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Available Tasks
          </h1>
          <span className="rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-sm font-medium text-slate-300">
            {taskList.length} {taskList.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        <p className="mt-3 text-lg text-slate-400">
          Browse open tasks and accept work to earn ETH on Base.
        </p>
      </motion.section>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error.message}
        </motion.div>
      )}

      {successBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successBanner} Redirecting to task details…
        </motion.div>
      )}

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-16 text-center"
        >
          <Hammer className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-slate-400">
            Connect your wallet to browse and accept tasks.
          </p>
        </motion.div>
      ) : tasksLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-lg">Loading tasks…</span>
        </div>
      ) : !taskList.length ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 py-16 text-center"
        >
          <Briefcase className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium text-slate-400">
            No available tasks right now
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Check back later for new work opportunities.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {taskList.map((task) => (
              <TaskCard
                key={task.id.toString()}
                task={task}
                isAccepting={isAccepting && acceptingTaskId === task.id}
                onAccept={() => {
                  setAcceptingTaskId(task.id);
                  acceptTask(task.jobId, task.id);
                }}
                canAccept={canAccept}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
