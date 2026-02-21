import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Briefcase,
  ChevronDown,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ImageIcon,
  Zap,
} from 'lucide-react';
import { useClientJobs } from '../hooks/useClientJobs';
import { useJob } from '../hooks/useJob';
import { useAiTasks, type AiTaskResult } from '../hooks/useAiTasks';
import { formatEth, ethToUsd } from '../lib/formatEth';
import { useEthPrice } from '../hooks/useEthPrice';
import { ipfsToHttp } from '../config/pinata';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { PageHeader } from '../components/ui/page-header';

const JOB_STATUS = ['Created', 'InProgress', 'Completed', 'Cancelled'] as const;

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
    case 0: return <Clock className="h-3.5 w-3.5 text-zinc-500" />;
    case 1: return <ArrowRight className="h-3.5 w-3.5 text-amber-400" />;
    case 2: return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
    case 3: return <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />;
    case 4: return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case 5: return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default: return <Clock className="h-3.5 w-3.5 text-zinc-500" />;
  }
}

const TASK_STATUS_LABEL: Record<number, string> = {
  0: 'Pending', 1: 'Open', 2: 'In Progress', 3: 'Verifying', 4: 'Completed', 5: 'Cancelled',
};

const STATUS_DOT: Record<number, string> = {
  0: 'bg-zinc-500', 1: 'bg-amber-400', 2: 'bg-blue-400', 3: 'bg-cyan-400', 4: 'bg-emerald-500', 5: 'bg-red-500',
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
      if (!cancelled) { setError(true); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [proofURI]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading proof…
      </div>
    );
  }

  if (error || imageUrls.length === 0) {
    return (
      <div className="py-2 text-xs text-zinc-500">
        Unable to load proof.{' '}
        <a href={ipfsToHttp(proofURI)} target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline">
          View raw
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {imageUrls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
          className="group relative overflow-hidden rounded-xl border border-border bg-surface-light transition hover:border-zinc-600">
          <img src={url} alt={`Proof ${i + 1}`}
            className="h-24 w-full object-cover transition group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/0 transition group-hover:bg-zinc-900/30">
            <ExternalLink className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
          </div>
        </a>
      ))}
    </div>
  );
}

function TaskResultRow({ task }: { task: TaskData }) {
  const { ethPrice } = useEthPrice();
  const isCompleted = task.status === 4;
  const hasProof = task.proofURI && task.proofURI.length > 0;

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 shrink-0">{getTaskIcon(task.status)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          {(() => {
            const lines = task.description.split('\n');
            const firstLine = lines[0] ?? '';
            const rest = lines.slice(1).join('\n').trimStart()
              .replace(/---\s*AI Research Findings\s*---/gi, 'Notes:');
            return (
              <div className="text-sm text-zinc-300 prose prose-invert prose-sm max-w-none">
                <p className="mb-2 text-zinc-300">{firstLine}</p>
                {rest && (
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="m-0">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children }) => <code className="rounded bg-surface-light px-1 py-0.5 text-xs font-mono text-purple-300">{children}</code>,
                    h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-semibold">{children}</h1>,
                    h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold">{children}</h2>,
                    h3: ({ children }) => <h3 className="mt-1 mb-0.5 text-sm font-semibold">{children}</h3>,
                  }}>
                    {rest}
                  </ReactMarkdown>
                )}
              </div>
            );
          })()}
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium text-amber-400">
              {formatEth(task.reward)} ETH
              {ethPrice && (
                <span className="ml-1 text-zinc-500 font-normal">
                  (~${ethToUsd(task.reward, ethPrice)})
                </span>
              )}
            </span>
            {isCompleted ? (
              <Badge variant="success">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Verified
              </Badge>
            ) : (
              <Badge dot={STATUS_DOT[task.status] ?? 'bg-zinc-500'}>
                {TASK_STATUS_LABEL[task.status] ?? 'Unknown'}
              </Badge>
            )}
          </div>
        </div>

        {task.proofRequirements && (
          <div className="mt-1 text-xs text-zinc-500 leading-relaxed prose prose-invert prose-xs max-w-none">
            <ReactMarkdown components={{
              p: ({ children }) => <p className="m-0">{children}</p>,
              ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-zinc-400">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => <code className="rounded bg-surface-light px-1 py-0.5 text-[10px] font-mono text-purple-300">{children}</code>,
            }}>
              {task.proofRequirements}
            </ReactMarkdown>
          </div>
        )}

        {task.rejectionReason && (
          <p className="mt-1 text-xs text-red-400/80">Rejected: {task.rejectionReason}</p>
        )}

        {isCompleted && hasProof && <ProofImageGallery proofURI={task.proofURI} />}

        {isCompleted && (
          <Link to={`/work/${task.id.toString()}`} state={{ from: '/jobs' }}
            className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300">
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
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 shrink-0">
        {isCompleted ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />
        ) : isFailed ? (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 text-purple-400 animate-spin" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-zinc-300">{task.description}</p>
          <Badge variant="purple">
            <Zap className="h-2.5 w-2.5" />
            AI
          </Badge>
        </div>
        {isCompleted && task.result && (
          <>
            <button onClick={() => setShowResult(!showResult)}
              className="mt-1 text-xs text-purple-400 hover:text-purple-300 transition">
              {showResult ? 'Hide findings' : 'Show findings'}
            </button>
            {showResult && (
              <div className="mt-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
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
  const { ethPrice } = useEthPrice();
  const { job, tasks, isLoading } = useJob(jobId);
  const { aiTasks: rawAiTasks } = useAiTasks(jobId);
  const jobIdStr = jobId.toString();
  const aiTasks = rawAiTasks.filter((t) => String(t.job_id) === jobIdStr);
  const [expanded, setExpanded] = useState(true);

  if (isLoading || !job) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading job…</span>
        </div>
      </Card>
    );
  }

  const jobData = Array.isArray(job)
    ? { description: job[2], totalBudget: job[3], status: job[7] as number }
    : { description: job.description, totalBudget: job.totalBudget, status: job.status as number };

  const rawTasks = (tasks ?? []) as unknown as TaskData[];
  const taskList = [...rawTasks].sort(
    (a, b) => Number(a.sequenceIndex ?? 0) - Number(b.sequenceIndex ?? 0),
  );
  const aiCompletedCount = aiTasks.filter((t) => t.status === 'completed').length;
  const humanCompletedCount = taskList.filter((t) => t.status === 4).length;
  const completedCount = aiCompletedCount + humanCompletedCount;
  const totalCount = taskList.length + aiTasks.length;
  const statusLabel = JOB_STATUS[Math.min(jobData.status, 3)] ?? 'Unknown';

  const statusVariant: Record<number, "default" | "warning" | "success" | "danger"> = {
    0: 'default', 1: 'warning', 2: 'success', 3: 'danger',
  };
  const statusDot: Record<number, string> = {
    0: 'bg-zinc-500', 1: 'bg-amber-400', 2: 'bg-emerald-500', 3: 'bg-red-500',
  };
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <Card hover>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-start gap-4 px-5 py-4 text-left transition"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200 leading-snug">{jobData.description}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-amber-400">
                {formatEth(jobData.totalBudget)} ETH
                {ethPrice && (
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    (~${ethToUsd(jobData.totalBudget, ethPrice)})
                  </span>
                )}
              </span>
              <Badge variant={statusVariant[jobData.status] ?? 'default'} dot={statusDot[jobData.status] ?? 'bg-zinc-500'}>
                {statusLabel}
              </Badge>
              <span className="text-xs text-zinc-500">
                {completedCount}/{totalCount} tasks
              </span>
            </div>
            {totalCount > 0 && (
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-light">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="mt-0.5 shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </motion.div>
        </button>

        {(jobData.status === 0 || jobData.status === 1) && totalCount === 0 && (
          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI agent is analyzing and decomposing your job…
            </div>
          </div>
        )}

        <AnimatePresence>
          {expanded && (aiTasks.length > 0 || taskList.length > 0) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="border-t border-border px-5 py-4 space-y-4">
                {aiTasks.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400/70">
                      AI Research
                    </p>
                    <div className="space-y-0.5">
                      {aiTasks.map((task) => (
                        <AiTaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                )}
                {taskList.length > 0 && (
                  <div>
                    {aiTasks.length > 0 && (
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Human Tasks
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {taskList.map((task, i) => (
                        <TaskResultRow key={i} task={task} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
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
      <PageHeader
        title="My Jobs"
        description="Track your posted jobs and view completed results."
        badge={
          isConnected && !isLoading ? (
            <Badge>
              {ids.length} {ids.length === 1 ? 'job' : 'jobs'}
            </Badge>
          ) : undefined
        }
      />

      {!isConnected ? (
        <EmptyState
          icon={Briefcase}
          title="Connect your wallet"
          description="Connect your wallet to view your jobs."
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading your jobs…</span>
        </div>
      ) : !hasJobs ? (
        <EmptyState
          icon={ImageIcon}
          title="No jobs yet"
          description="Post your first job to get started."
        >
          <Link to="/">
            <Button variant="secondary" size="md">
              <Briefcase className="h-4 w-4" />
              Post a Job
            </Button>
          </Link>
        </EmptyState>
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
