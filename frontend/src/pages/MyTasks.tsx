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
  Star,
} from "lucide-react";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";
import { formatEth, ethToUsd } from "../lib/formatEth";
import { useEthPrice } from "../hooks/useEthPrice";
import { useMyTasks } from "../hooks/useMyTasks";
import { useVerificationHistory, type VerificationRecord } from "../hooks/useVerificationHistory";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardBody, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { PageHeader } from "../components/ui/page-header";

const TASK_STATUS = {
  0: { label: "Pending",              dot: "bg-zinc-500",   variant: "default"  as const },
  1: { label: "Open",                 dot: "bg-blue-400",   variant: "info"     as const },
  2: { label: "In Progress",          dot: "bg-amber-400",  variant: "warning"  as const },
  3: { label: "Pending Verification", dot: "bg-cyan-400",   variant: "info"     as const },
  4: { label: "Completed",            dot: "bg-emerald-500",variant: "success"  as const },
  5: { label: "Cancelled",            dot: "bg-red-500",    variant: "danger"   as const },
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

function TaskRow({ taskId, bonusRecord }: { taskId: bigint; bonusRecord?: VerificationRecord }) {
  const { ethPrice } = useEthPrice();
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

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="mb-3 h-3 w-20 animate-pulse rounded-xl bg-surface-light" />
        <div className="mb-3 h-4 w-full animate-pulse rounded-xl bg-surface-light" />
        <div className="mb-3 h-4 w-3/4 animate-pulse rounded-xl bg-surface-lighter/30" />
        <div className="h-9 w-24 animate-pulse rounded-xl bg-surface-light" />
      </Card>
    );
  }

  if (!parsedTask) return null;

  const hasBonusValue = bonusRecord?.bonus_wei && bonusRecord.bonus_wei !== "0" && bonusRecord.bonus_wei !== "";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card hover className="flex flex-col">
        <CardHeader className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Task #{parsedTask.id.toString()}</span>
          <Badge
            variant={statusMeta?.variant ?? "default"}
            dot={parsedTask.status !== 3 ? (statusMeta?.dot ?? "bg-zinc-500") : undefined}
          >
            {parsedTask.status === 3 && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {statusMeta?.label ?? "Unknown"}
          </Badge>
        </CardHeader>

        <CardBody className="flex-1">
          <p className="text-sm text-zinc-200 leading-snug">
            {truncate(parsedTask.description)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              {formatEth(parsedTask.reward)} ETH
              {ethPrice && (
                <span className="text-xs font-normal text-zinc-500">
                  (~${ethToUsd(parsedTask.reward, ethPrice)})
                </span>
              )}
            </span>
            {parsedTask.status === 4 && hasBonusValue && bonusRecord && (
              <Badge variant="success">
                <Star className="h-2.5 w-2.5" />
                +{(Number(BigInt(bonusRecord.bonus_wei)) / 1e18).toFixed(4)} ETH bonus
              </Badge>
            )}
          </div>
        </CardBody>

        <CardFooter>
          <Link
            to={`/work/${parsedTask.id.toString()}`}
            state={{ from: "/my-tasks" }}
          >
            <Button variant="secondary" size="sm">
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.article>
  );
}

export default function MyTasks() {
  const { isConnected, address } = useAccount();
  const { taskIds, isLoading } = useMyTasks();
  const { data: verificationHistory } = useVerificationHistory(address);

  const ids = taskIds ?? [];
  const hasTasks = ids.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My Work"
        description="View your accepted and completed work on the Relayer marketplace."
        badge={
          isConnected && !isLoading ? (
            <Badge>
              {ids.length} {ids.length === 1 ? "task" : "tasks"}
            </Badge>
          ) : undefined
        }
      />

      {!isConnected ? (
        <EmptyState
          icon={User}
          title="Connect your wallet"
          description="Connect your wallet to view your tasks."
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading your tasks…</span>
        </div>
      ) : !hasTasks ? (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks yet"
          description="Accept tasks from the marketplace to see them here."
        >
          <Link to="/work">
            <Button variant="secondary" size="md">
              <ExternalLink className="h-4 w-4" />
              Browse marketplace
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ids.map((taskId) => (
              <TaskRow
                key={taskId.toString()}
                taskId={taskId}
                bonusRecord={verificationHistory?.find((v) => v.task_id === Number(taskId))}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
