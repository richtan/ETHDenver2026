import { useState, useRef, useEffect } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Clock,
  Coins,
  Upload,
  CheckCircle2,
  XCircle,
  Image,
  Loader2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CONTRACT_ADDRESS } from "../config/wagmi";
import { JOB_MARKETPLACE_ABI } from "../abi/JobMarketplace";
import { ipfsToHttp } from "../config/pinata";
import { formatEth } from "../lib/formatEth";
import { useAcceptTask } from "../hooks/useAcceptTask";
import { useSubmitProof } from "../hooks/useSubmitProof";
import { useUploadProof } from "../hooks/useUploadProof";

const TASK_STATUS = {
  0: { label: "Pending", color: "text-slate-400", icon: Clock },
  1: { label: "Open", color: "text-blue-400", icon: Clock },
  2: { label: "Accepted", color: "text-amber-400", icon: CheckCircle2 },
  3: { label: "Pending Verification", color: "text-cyan-400", icon: Loader2 },
  4: { label: "Completed", color: "text-emerald-400", icon: CheckCircle2 },
  5: { label: "Cancelled", color: "text-red-400", icon: XCircle },
} as const;

function formatDeadline(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  if (deadlineNum <= now) return "Expired";
  return formatDistanceToNow(new Date(deadlineNum * 1000), { addSuffix: true });
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { address } = useAccount();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from === "/jobs" ? "/jobs" : from === "/my-tasks" ? "/my-tasks" : "/work";
  const backLabel = from === "/jobs" ? "Back to My Jobs" : from === "/my-tasks" ? "Back to My Work" : "Back to Marketplace";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [proofSubmitted, setProofSubmitted] = useState(false);

  const { data: task, isLoading: taskLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getTask",
    args: taskId ? [BigInt(taskId)] : undefined,
    query: { refetchInterval: 3_000 },
  });

  const jobId = task ? (task as { jobId: bigint }).jobId : undefined;
  const sequenceIndex = task ? (task as { sequenceIndex: bigint }).sequenceIndex : undefined;

  const { data: previousDeliverableUri } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "getPreviousDeliverable",
    args: jobId !== undefined && taskId ? [jobId, BigInt(taskId)] : undefined,
  });

  const { acceptTask, isPending: accepting, isConfirming: confirmingAccept, isSuccess: acceptSuccess } = useAcceptTask();
  const { submitProof, isPending: submitting, isConfirming: confirmingSubmit, isSuccess: submitSuccess } = useSubmitProof();
  const { upload, uploading, ipfsUri, error: uploadError, progress } = useUploadProof();

  useEffect(() => {
    if (submitSuccess) setProofSubmitted(true);
  }, [submitSuccess]);

  const parsedTask = task as
    | {
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
      }
    | undefined;

  const isWorker = parsedTask && address && parsedTask.worker.toLowerCase() === address.toLowerCase();
  const canAccept = parsedTask?.status === 1 && address && !accepting && !confirmingAccept;
  const showProofUpload =
    parsedTask?.status === 2 && isWorker && address && !proofSubmitted;
  const showProofVerifying =
    (parsedTask?.status === 2 && proofSubmitted) || false;

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    await upload(selectedFiles);
  }

  function handleSubmitProof() {
    if (!parsedTask || !ipfsUri) return;
    submitProof(parsedTask.jobId, parsedTask.id, ipfsUri);
  }

  function clearSelection() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!taskId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <p className="mt-8 text-slate-500">Invalid task ID.</p>
      </div>
    );
  }

  if (taskLoading || !parsedTask) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <div className="mt-12 flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-lg">Loading task…</span>
        </div>
      </div>
    );
  }

  const statusMeta = TASK_STATUS[parsedTask.status as keyof typeof TASK_STATUS] ?? TASK_STATUS[0];
  const StatusIcon = statusMeta.icon;
  const deadlineStr = formatDeadline(parsedTask.deadline);
  const isExpired = deadlineStr === "Expired";
  const prevUri = typeof previousDeliverableUri === "string" ? previousDeliverableUri : "";
  const hasPreviousDeliverable = parsedTask.sequenceIndex > 0n && prevUri && prevUri.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </motion.div>

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="mt-6 space-y-6"
      >
        <motion.section
          variants={cardVariants}
          className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Task #{parsedTask.id.toString()}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-sm font-medium ${statusMeta.color}`}
            >
              <StatusIcon
                className={
                  parsedTask.status === 3 ? "h-4 w-4 animate-spin" : "h-4 w-4"
                }
              />
              {statusMeta.label}
            </span>
          </div>

          <div className="text-xl font-semibold tracking-tight text-white prose prose-invert prose-lg max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="m-0">{children}</p>,
                ul: ({ children }) => <ul className="my-2 ml-6 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 ml-6 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="my-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => <code className="rounded bg-slate-800/50 px-1.5 py-0.5 text-sm font-mono text-purple-300">{children}</code>,
                h1: ({ children }) => <h1 className="mt-3 mb-2 text-2xl font-bold">{children}</h1>,
                h2: ({ children }) => <h2 className="mt-3 mb-2 text-xl font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-2 mb-1 text-lg font-semibold">{children}</h3>,
              }}
            >
              {parsedTask.description}
            </ReactMarkdown>
          </div>

          {parsedTask.proofRequirements && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-400">
                Proof requirements
              </h3>
              <div className="mt-1.5 text-slate-300 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="m-0">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-200">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children }) => <code className="rounded bg-slate-800/50 px-1 py-0.5 text-xs font-mono text-purple-300">{children}</code>,
                  }}
                >
                  {parsedTask.proofRequirements}
                </ReactMarkdown>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-2 text-amber-400">
              <Coins className="h-4 w-4" />
              <span className="font-medium">{formatEth(parsedTask.reward)} ETH</span>
            </span>
            <span
              className={`inline-flex items-center gap-2 ${
                isExpired ? "text-red-400/90" : "text-slate-400"
              }`}
            >
              <Clock className="h-4 w-4" />
              {deadlineStr}
            </span>
          </div>

          {parsedTask.rejectionReason && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
            >
              <p className="text-sm font-medium text-red-400">Rejection reason</p>
              <p className="mt-1 text-slate-300">{parsedTask.rejectionReason}</p>
            </motion.div>
          )}

          {parsedTask.status === 1 && canAccept && !acceptSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <button
                type="button"
                onClick={() => acceptTask(parsedTask.jobId, parsedTask.id)}
                disabled={accepting || confirmingAccept || isExpired}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(accepting || confirmingAccept) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Accepting…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Accept Task
                  </>
                )}
              </button>
            </motion.div>
          )}

          {acceptSuccess && parsedTask.status === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-400">
                Task accepted! You can now submit your proof below.
              </p>
            </motion.div>
          )}
        </motion.section>

        {hasPreviousDeliverable && (
          <motion.section
            variants={cardVariants}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-sm"
          >
            <h3 className="text-sm font-medium text-slate-400">
              Previous deliverable
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              This task depends on output from the previous task in the sequence.
            </p>
            <a
              href={ipfsToHttp(prevUri)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              View previous deliverable
            </a>
          </motion.section>
        )}

        {showProofUpload && (
          <motion.section
            variants={cardVariants}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-sm"
          >
            <h3 className="text-sm font-medium text-slate-400">
              Submit proof
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload one or more images as proof of task completion.
            </p>

            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesChange}
                className="hidden"
              />

              {selectedFiles.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700/60 bg-slate-800/30 py-8 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-300"
                >
                  <Image className="h-10 w-10" />
                  <span className="text-sm font-medium">Choose images or take photo</span>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* Thumbnail grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <AnimatePresence mode="popLayout">
                      {previewUrls.map((url, i) => (
                        <motion.div
                          key={url}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/30"
                        >
                          <img
                            src={url}
                            alt={`Proof ${i + 1}`}
                            className="h-28 w-full object-cover"
                          />
                          {!ipfsUri && (
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {!ipfsUri && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-700/60 bg-slate-800/20 text-slate-500 transition hover:border-slate-600 hover:text-slate-300"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-xs">Add more</span>
                      </button>
                    )}
                  </div>

                  {uploadError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                      <p className="text-sm text-red-400">{uploadError}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!ipfsUri ? (
                      <>
                        <button
                          type="button"
                          onClick={handleUpload}
                          disabled={uploading}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Uploading {progress.done}/{progress.total}…
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              Upload {selectedFiles.length} {selectedFiles.length === 1 ? "image" : "images"} to IPFS
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={clearSelection}
                          className="rounded-lg border border-slate-600/60 px-4 py-2.5 text-sm text-slate-400 transition hover:text-white"
                        >
                          Clear all
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="flex flex-1 items-center gap-2 truncate rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span className="truncate">{ipfsUri}</span>
                        </p>
                        <button
                          type="button"
                          onClick={handleSubmitProof}
                          disabled={submitting || confirmingSubmit}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {(submitting || confirmingSubmit) ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Submitting…
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Submit proof on-chain
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {showProofVerifying && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <h3 className="text-sm font-medium text-cyan-400">
                Proof Submitted
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Your proof has been submitted on-chain. The AI agent is analyzing
              your work and will verify it shortly.
            </p>
          </motion.section>
        )}

        {(parsedTask.status === 3 || parsedTask.status === 4) && parsedTask.proofURI && (
          <motion.section
            variants={cardVariants}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-sm"
          >
            <h3 className="text-sm font-medium text-slate-400">
              {parsedTask.status === 4 ? "Submitted proof" : "Proof submitted"}
            </h3>
            <a
              href={ipfsToHttp(parsedTask.proofURI)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              View proof
            </a>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}
