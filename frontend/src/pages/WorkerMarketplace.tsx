import { useState, useEffect, useMemo } from 'react';
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
  UserCog,
  Sparkles,
  List,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useOpenTasks } from '../hooks/useOpenTasks';
import { useAcceptTask } from '../hooks/useAcceptTask';
import { useClientJobs } from '../hooks/useClientJobs';
import { useJob } from '../hooks/useJob';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import {
  useRecommendedTasks,
  type TaskRecommendation,
} from '../hooks/useRecommendedTasks';
import { useTaskTags } from '../hooks/useTaskTags';
import { WorkerProfilePanel } from '../components/WorkerProfilePanel';
import { formatEth, ethToUsd } from '../lib/formatEth';
import { useEthPrice } from '../hooks/useEthPrice';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { PageHeader } from '../components/ui/page-header';

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
  return formatDistanceToNow(new Date(deadlineNum * 1000), { addSuffix: true });
}

function JobContextBadge({ jobId }: { jobId: bigint }) {
  const { job, isLoading } = useJob(jobId);

  if (isLoading || !job) {
    return (
      <Badge>
        <Briefcase className="h-3 w-3" />
        Job #{jobId.toString()}
      </Badge>
    );
  }

  const desc = Array.isArray(job) ? job[2] : job.description;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-light px-2 py-0.5 text-xs text-zinc-500"
      title={desc}
    >
      <Briefcase className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[120px]">{truncate(desc, 25)}</span>
    </span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

function TaskCard({
  task,
  isAccepting,
  onAccept,
  canAccept,
  taskTags,
  workerTags,
  recommendation,
}: {
  task: TaskStruct;
  isAccepting: boolean;
  onAccept: () => void;
  canAccept: boolean;
  taskTags?: string[];
  workerTags?: string[];
  recommendation?: TaskRecommendation;
}) {
  const { ethPrice } = useEthPrice();
  const { id, jobId, description, reward, deadline } = task;
  const deadlineStr = formatDeadline(deadline);
  const isExpired = deadlineStr === 'Expired';
  const matchPercent = recommendation ? Math.round(recommendation.score * 100) : 0;

  return (
    <motion.article variants={cardVariants}>
      <Card hover className="group relative flex flex-col h-full">
        {recommendation && matchPercent > 0 && (
          <div className="absolute -top-2.5 right-3 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 shadow-sm">
              <Sparkles className="h-2.5 w-2.5" />
              {matchPercent}% match
            </span>
          </div>
        )}

        <div className="p-5 flex flex-col flex-1 gap-3">
          <div>
            <JobContextBadge jobId={jobId} />
          </div>

          <p className="text-sm text-zinc-300 line-clamp-3 leading-relaxed">
            {truncate(description)}
          </p>

          {taskTags && taskTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {taskTags.map((tag) => {
                const isMatch = workerTags?.includes(tag);
                return (
                  <span
                    key={tag}
                    className={`rounded-xl px-1.5 py-0.5 text-[10px] font-medium ${
                      isMatch
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-surface-light text-zinc-600 border border-border'
                    }`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium text-amber-400">
              <Coins className="h-3.5 w-3.5" />
              {formatEth(reward)} ETH
              {ethPrice && (
                <span className="text-zinc-600 font-normal">
                  (~${ethToUsd(reward, ethPrice)})
                </span>
              )}
            </span>
            <span className={`flex items-center gap-1.5 ${isExpired ? 'text-red-400/80' : 'text-zinc-600'}`}>
              <Clock className="h-3.5 w-3.5" />
              {deadlineStr}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <Link
            to={`/work/${id.toString()}`}
            state={{ from: '/work' }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-light h-9 px-3 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            View Details
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Button
            variant="success"
            size="sm"
            onClick={onAccept}
            disabled={!canAccept || isExpired || isAccepting}
            className="min-w-[90px]"
          >
            {isAccepting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Accepting…</>
            ) : (
              <><Hammer className="h-3.5 w-3.5" />Accept</>
            )}
          </Button>
        </div>
      </Card>
    </motion.article>
  );
}

type Tab = 'forYou' | 'all';

export default function WorkerMarketplace() {
  const { isConnected, address } = useAccount();
  const navigate = useNavigate();
  const { data: tasks, isLoading: tasksLoading } = useOpenTasks();
  const { jobIds: myJobIds } = useClientJobs();
  const { acceptTask, isPending, isConfirming, isSuccess, error } = useAcceptTask();
  const { data: profile } = useWorkerProfile(address);
  const { data: taskTagsData } = useTaskTags();

  const [acceptingTaskId, setAcceptingTaskId] = useState<bigint | null>(null);
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<bigint>>(new Set());
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('forYou');

  useEffect(() => {
    if (!isSuccess || acceptingTaskId === null) return;
    setHiddenTaskIds((prev) => new Set(prev).add(acceptingTaskId));
    setSuccessBanner(`Task #${acceptingTaskId.toString()} accepted!`);
    const navTimer = setTimeout(() => {
      navigate(`/work/${acceptingTaskId.toString()}`, { state: { from: '/work' } });
    }, 1500);
    return () => clearTimeout(navTimer);
  }, [isSuccess, acceptingTaskId, navigate]);

  const myJobIdSet = new Set(myJobIds?.map((id) => id.toString()) ?? []);

  const taskList: TaskStruct[] = Array.isArray(tasks)
    ? tasks.filter(
        (t): t is TaskStruct =>
          t != null && typeof t === 'object' && 'id' in t && 'jobId' in t &&
          !hiddenTaskIds.has(t.id) && !myJobIdSet.has(t.jobId.toString()),
      )
    : [];

  const openTaskIds = useMemo(() => taskList.map((t) => t.id.toString()), [taskList]);
  const workerTags = profile?.tags ?? [];
  const { data: recommendations } = useRecommendedTasks(address, openTaskIds);

  const taskTagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (taskTagsData) for (const entry of taskTagsData) map.set(entry.task_id, entry.tags);
    return map;
  }, [taskTagsData]);

  const recMap = useMemo(() => {
    const map = new Map<string, TaskRecommendation>();
    if (recommendations) for (const rec of recommendations) map.set(rec.taskId, rec);
    return map;
  }, [recommendations]);

  const forYouTasks = useMemo(() => {
    if (!recommendations || recommendations.length === 0) return [];
    const recOrder = new Map(recommendations.map((r, i) => [r.taskId, i]));
    return [...taskList]
      .filter((t) => recMap.has(t.id.toString()))
      .sort((a, b) => {
        const aIdx = recOrder.get(a.id.toString()) ?? Infinity;
        const bIdx = recOrder.get(b.id.toString()) ?? Infinity;
        return aIdx - bIdx;
      });
  }, [taskList, recommendations, recMap]);

  const canAccept = isConnected && !isPending && !isConfirming;
  const isAccepting = isPending || isConfirming;
  const hasWorkerTags = workerTags.length > 0;
  const displayTasks = activeTab === 'forYou' ? forYouTasks : taskList;

  return (
    <div className="mx-auto max-w-6xl">
      <AnimatePresence>
        {showProfile && address && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black"
              onClick={() => setShowProfile(false)}
            />
            <WorkerProfilePanel address={address} onClose={() => setShowProfile(false)} />
          </>
        )}
      </AnimatePresence>

      <PageHeader
        title="Marketplace"
        description="Browse open tasks and accept work to earn on Base."
        badge={
          <Badge>
            {taskList.length} {taskList.length === 1 ? 'task' : 'tasks'}
          </Badge>
        }
        actions={
          isConnected ? (
            <Button variant="secondary" size="sm" onClick={() => setShowProfile(true)}>
              <UserCog className="h-3.5 w-3.5" />
              {hasWorkerTags ? `${workerTags.length} skill${workerTags.length !== 1 ? 's' : ''}` : 'Set Skills'}
            </Button>
          ) : undefined
        }
      />

      {isConnected && (
        <div className="mb-6 flex gap-0.5 rounded-xl border border-border bg-card p-1 w-fit shadow-sm">
          {([
            { id: 'forYou', label: 'For You', icon: Sparkles },
            { id: 'all', label: 'All Tasks', icon: List },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                activeTab === id
                  ? 'bg-surface-light text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
        >
          {error.message}
        </motion.div>
      )}

      {successBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successBanner} Redirecting…
        </motion.div>
      )}

      {!isConnected ? (
        <EmptyState
          icon={Hammer}
          title="Connect your wallet"
          description="Connect your wallet to browse tasks."
        />
      ) : tasksLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-zinc-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading tasks…</span>
        </div>
      ) : activeTab === 'forYou' && !hasWorkerTags ? (
        <EmptyState
          icon={UserCog}
          title="Set up your skills for personalized matches"
          description="Tell us what you're good at and we'll match you with tasks."
        >
          <Button variant="success" size="md" onClick={() => setShowProfile(true)}>
            <UserCog className="h-4 w-4" />
            Set Skills
          </Button>
        </EmptyState>
      ) : !displayTasks.length ? (
        <EmptyState
          icon={Briefcase}
          title={activeTab === 'forYou' ? 'No matching tasks right now' : 'No available tasks right now'}
          description={activeTab === 'forYou' ? 'Try adding more skills or check the All Tasks tab.' : 'Check back later for new work.'}
        />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          key={activeTab}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {displayTasks.map((task) => {
              const taskIdStr = task.id.toString();
              return (
                <TaskCard
                  key={taskIdStr}
                  task={task}
                  isAccepting={isAccepting && acceptingTaskId === task.id}
                  onAccept={() => { setAcceptingTaskId(task.id); acceptTask(task.jobId, task.id); }}
                  canAccept={canAccept}
                  taskTags={taskTagMap.get(taskIdStr)}
                  workerTags={workerTags}
                  recommendation={recMap.get(taskIdStr)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
