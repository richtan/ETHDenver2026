import { useState, useRef, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  Clock,
  Upload,
  CheckCircle2,
  XCircle,
  Image,
  Loader2,
  ExternalLink,
  Plus,
  Star,
  TrendingUp,
  Coins,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CONTRACT_ADDRESS } from '../config/wagmi';
import { JOB_MARKETPLACE_ABI } from '../abi/JobMarketplace';
import { ipfsToHttp } from '../config/pinata';
import { formatEth, ethToUsd } from '../lib/formatEth';
import { useEthPrice } from '../hooks/useEthPrice';
import { useAcceptTask } from '../hooks/useAcceptTask';
import { useSubmitProof } from '../hooks/useSubmitProof';
import { useUploadProof } from '../hooks/useUploadProof';
import { useVerificationHistory } from '../hooks/useVerificationHistory';
import { useWorkerReputation } from '../hooks/useWorkerReputation';
import { TIER_CONFIG } from '../components/ReputationSection';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardBody } from '../components/ui/card';

const TASK_STATUS = {
  0: { label: 'Pending',              dot: 'bg-zinc-500',   variant: 'default' as const },
  1: { label: 'Open',                 dot: 'bg-blue-400',   variant: 'info'    as const },
  2: { label: 'In Progress',          dot: 'bg-amber-400',  variant: 'warning' as const },
  3: { label: 'Pending Verification', dot: 'bg-cyan-400',   variant: 'info'    as const },
  4: { label: 'Completed',            dot: 'bg-emerald-500',variant: 'success' as const },
  5: { label: 'Cancelled',            dot: 'bg-red-500',    variant: 'danger'  as const },
} as const;

function formatDeadline(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  if (deadlineNum <= now) return 'Expired';
  return formatDistanceToNow(new Date(deadlineNum * 1000), { addSuffix: true });
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { address } = useAccount();
  const { ethPrice } = useEthPrice();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from === '/jobs' ? '/jobs' : from === '/my-tasks' ? '/my-tasks' : '/work';
  const backLabel =
    from === '/jobs' ? 'My Jobs' : from === '/my-tasks' ? 'My Work' : 'Marketplace';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [proofSubmitted, setProofSubmitted] = useState(false);

  const { data: task, isLoading: taskLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: JOB_MARKETPLACE_ABI,
    functionName: 'getTask',
    args: taskId ? [BigInt(taskId)] : undefined,
    query: { refetchInterval: 3_000 },
  });

  const jobId = task ? (task as { jobId: bigint }).jobId : undefined;

  const { data: previousDeliverableUri } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: JOB_MARKETPLACE_ABI,
    functionName: 'getPreviousDeliverable',
    args: jobId !== undefined && taskId ? [jobId, BigInt(taskId)] : undefined,
  });

  const { acceptTask, isPending: accepting, isConfirming: confirmingAccept, isSuccess: acceptSuccess } = useAcceptTask();
  const { submitProof, isPending: submitting, isConfirming: confirmingSubmit, isSuccess: submitSuccess } = useSubmitProof();
  const { upload, uploading, ipfsUri, error: uploadError, progress } = useUploadProof();

  useEffect(() => { if (submitSuccess) setProofSubmitted(true); }, [submitSuccess]);

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

  useEffect(() => {
    if (parsedTask?.rejectionReason && parsedTask?.status === 2) setProofSubmitted(false);
  }, [parsedTask?.rejectionReason, parsedTask?.status]);

  const { data: verificationHistory } = useVerificationHistory(address);
  const { data: reputation } = useWorkerReputation(address);

  const isWorker = parsedTask && address && parsedTask.worker.toLowerCase() === address.toLowerCase();
  const verificationRecord = verificationHistory?.find((v) => v.task_id === Number(taskId));
  const bonusWei = verificationRecord?.bonus_wei ?? "0";
  const hasBonusValue = bonusWei !== "0" && bonusWei !== "";
  const bonusEth = hasBonusValue ? Number(BigInt(bonusWei)) / 1e18 : 0;
  const canAccept = parsedTask?.status === 1 && address && !accepting && !confirmingAccept;
  const showProofUpload = parsedTask?.status === 2 && isWorker && address && !proofSubmitted;
  const showProofVerifying = (parsedTask?.status === 2 && proofSubmitted) || false;

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const BackNav = () => (
    <Link to={backTo}
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-200">
      <ArrowLeft className="h-3.5 w-3.5" />
      {backLabel}
    </Link>
  );

  if (!taskId) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackNav />
        <p className="mt-8 text-sm text-zinc-500">Invalid task ID.</p>
      </div>
    );
  }

  if (taskLoading || !parsedTask) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackNav />
        <div className="mt-12 flex items-center justify-center gap-2 py-20 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading task…</span>
        </div>
      </div>
    );
  }

  const statusMeta = TASK_STATUS[parsedTask.status as keyof typeof TASK_STATUS] ?? TASK_STATUS[0];
  const deadlineStr = formatDeadline(parsedTask.deadline);
  const isExpired = deadlineStr === 'Expired';
  const prevUri = typeof previousDeliverableUri === 'string' ? previousDeliverableUri : '';
  const hasPreviousDeliverable = parsedTask.sequenceIndex > 0n && prevUri && prevUri.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <BackNav />
        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Task #{parsedTask.id.toString()}
          </h1>
          <Badge
            variant={statusMeta.variant}
            dot={parsedTask.status !== 3 ? statusMeta.dot : undefined}
          >
            {parsedTask.status === 3 && <Loader2 className="h-3 w-3 animate-spin" />}
            {statusMeta.label}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {/* Main task card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardBody>
              {(() => {
                const lines = parsedTask.description.split("\n");
                const firstLine = lines[0] ?? "";
                const rest = lines.slice(1).join("\n").trimStart()
                  .replace(/---\s*AI Research Findings\s*---/gi, "Notes:");
                return (
                  <div className="text-sm text-zinc-300 prose prose-invert prose-sm max-w-none">
                    <p className="mb-3 font-medium text-white">{firstLine}</p>
                    {rest && (
                      <ReactMarkdown components={{
                        p: ({ children }) => <p className="m-0">{children}</p>,
                        ul: ({ children }) => <ul className="my-1 ml-5 list-disc">{children}</ul>,
                        ol: ({ children }) => <ol className="my-1 ml-5 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="my-0.5">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children }) => <code className="rounded bg-surface-light px-1 py-0.5 text-xs font-mono text-purple-300">{children}</code>,
                        h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-bold text-white">{children}</h1>,
                        h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold text-white">{children}</h2>,
                        h3: ({ children }) => <h3 className="mt-1 mb-0.5 text-sm font-semibold text-zinc-200">{children}</h3>,
                      }}>
                        {rest}
                      </ReactMarkdown>
                    )}
                  </div>
                );
              })()}
            </CardBody>

            {parsedTask.proofRequirements && (
              <div className="border-t border-border px-5 py-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Proof Requirements
                </p>
                <div className="text-sm text-zinc-400 prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="m-0">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-zinc-300">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children }) => <code className="rounded bg-surface-light px-1 py-0.5 text-xs font-mono text-purple-300">{children}</code>,
                  }}>
                    {parsedTask.proofRequirements}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            <div className="border-t border-border px-5 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                  <Coins className="h-3.5 w-3.5" />
                  {formatEth(parsedTask.reward)} ETH
                  {ethPrice && (
                    <span className="font-normal text-xs text-zinc-500">
                      (~${ethToUsd(parsedTask.reward, ethPrice)})
                    </span>
                  )}
                </span>
                {parsedTask.status === 4 && isWorker && hasBonusValue && (
                  <Badge variant="success">
                    <Star className="h-3 w-3" />
                    +{bonusEth.toFixed(4)} ETH bonus
                  </Badge>
                )}
                <span className={`inline-flex items-center gap-1.5 text-sm ${isExpired ? 'text-red-400' : 'text-zinc-500'}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {deadlineStr}
                </span>
              </div>

              {parsedTask.status === 2 && isWorker && reputation && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-light px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-500">
                    {reputation.tier !== "none" ? (
                      <>
                        Your <span className={TIER_CONFIG[reputation.tier].color}>{TIER_CONFIG[reputation.tier].label}</span> tier earns{" "}
                        <span className="text-white font-medium">{TIER_CONFIG[reputation.tier].bonus}</span> bonus on approved work
                      </>
                    ) : (
                      "High reputation earns up to +10% bonus on approved work"
                    )}
                  </span>
                </div>
              )}
            </div>

            {parsedTask.rejectionReason && (
              <div className="border-t border-border px-5 py-4">
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-400 mb-1.5">Rejection reason</p>
                  {parsedTask.rejectionReason.split('\n').map((line, i) => (
                    <p key={i} className="text-sm text-zinc-300">{line}</p>
                  ))}
                </div>
              </div>
            )}

            {parsedTask.status === 1 && canAccept && !acceptSuccess && (
              <div className="border-t border-border px-5 py-4">
                <Button
                  variant="success"
                  size="md"
                  onClick={() => acceptTask(parsedTask.jobId, parsedTask.id)}
                  disabled={accepting || confirmingAccept || isExpired}
                >
                  {accepting || confirmingAccept ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Accepting…</>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" />Accept Task</>
                  )}
                </Button>
              </div>
            )}

            {acceptSuccess && parsedTask.status === 1 && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm text-emerald-400">Task accepted! You can now submit your proof below.</p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {hasPreviousDeliverable && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium text-white">Previous deliverable</h3>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-zinc-500">
                  This task depends on output from the previous task in the sequence.
                </p>
                <a
                  href={ipfsToHttp(prevUri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block"
                >
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View previous deliverable
                  </Button>
                </a>
              </CardBody>
            </Card>
          </motion.div>
        )}

        {showProofUpload && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium text-white">Submit proof</h3>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-zinc-500 mb-4">
                  Upload one or more images as proof of task completion.
                </p>

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
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-zinc-500 transition hover:border-zinc-600 hover:bg-surface-light/30 hover:text-zinc-300"
                  >
                    <Image className="h-8 w-8" />
                    <span className="text-sm">Choose images or take a photo</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <AnimatePresence mode="popLayout">
                        {previewUrls.map((url, i) => (
                          <motion.div
                            key={url}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative overflow-hidden rounded-xl border border-border bg-surface-light"
                          >
                            <img src={url} alt={`Proof ${i + 1}`}
                              className="h-28 w-full object-cover" />
                            {!ipfsUri && (
                              <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="absolute right-1 top-1 rounded-full bg-zinc-900/80 p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
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
                          className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-xs">Add more</span>
                        </button>
                      )}
                    </div>

                    {uploadError && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                        <p className="text-sm text-red-400">{uploadError}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {!ipfsUri ? (
                        <>
                          <Button onClick={handleUpload} disabled={uploading}>
                            {uploading ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading {progress.done}/{progress.total}…</>
                            ) : (
                              <><Upload className="h-3.5 w-3.5" />Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'image' : 'images'} to IPFS</>
                            )}
                          </Button>
                          <Button variant="secondary" onClick={clearSelection}>
                            Clear all
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="flex flex-1 items-center gap-2 truncate rounded-xl border border-border bg-surface-light px-3 py-2 text-xs text-zinc-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span className="truncate">{ipfsUri}</span>
                          </p>
                          <Button
                            variant="success"
                            onClick={handleSubmitProof}
                            disabled={submitting || confirmingSubmit}
                          >
                            {submitting || confirmingSubmit ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Submitting…</>
                            ) : (
                              <><CheckCircle2 className="h-3.5 w-3.5" />Submit proof on-chain</>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}

        {showProofVerifying && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-cyan-500/20 bg-cyan-500/5"
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-cyan-400">Proof Submitted</p>
                <p className="mt-0.5 text-sm text-zinc-400">
                  Your proof has been submitted on-chain. The AI agent is analyzing your work and will verify it shortly.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {(parsedTask.status === 3 || parsedTask.status === 4) && parsedTask.proofURI && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium text-white">
                  {parsedTask.status === 4 ? 'Submitted proof' : 'Proof submitted'}
                </h3>
              </CardHeader>
              <CardBody>
                <a
                  href={ipfsToHttp(parsedTask.proofURI)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View proof on IPFS
                  </Button>
                </a>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
