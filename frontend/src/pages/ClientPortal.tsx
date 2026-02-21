import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Zap,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  ListChecks,
  Coins,
  SkipForward,
  ArrowLeft,
  Wallet,
} from 'lucide-react';
import { useCreateJob } from '../hooks/useCreateJob';
import { useEthPrice } from '../hooks/useEthPrice';
import { usdToEth } from '../lib/formatEth';
import { AGENT_API_URL } from '../config/wagmi';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/card';
import { Textarea } from '../components/ui/input';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { PageHeader } from '../components/ui/page-header';

interface TaskPreview {
  description: string;
  proofRequirements: string;
  reward: string;
  executorType?: 'ai' | 'human';
}

interface QAPair {
  question: string;
  answer: string;
}

function ClarificationView({
  description,
  budget,
  conversation,
  currentQuestions,
  taskPreview,
  isLoading,
  isReady,
  onSubmitAnswers,
  onCreateJob,
  onSkip,
  isCreating,
  ethPrice,
}: {
  description: string;
  budget: string;
  conversation: QAPair[];
  currentQuestions: string[];
  taskPreview: TaskPreview[];
  isLoading: boolean;
  isReady: boolean;
  onSubmitAnswers: (answers: string[]) => void;
  onCreateJob: () => void;
  onSkip: () => void;
  isCreating: boolean;
  ethPrice: number | null;
}) {
  const [answers, setAnswers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnswers(currentQuestions.map(() => ''));
  }, [currentQuestions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, currentQuestions, isLoading]);

  const canSubmitAnswers =
    answers.length > 0 && answers.every((a) => a.trim().length > 0);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left: Conversation */}
      <div className="flex-1 min-w-0">
        <Card>
          <div className="max-h-128 overflow-y-auto px-5 py-5 space-y-5">
            {/* Original description */}
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-light text-[10px] font-semibold">
                You
              </div>
              <div className="rounded-xl bg-surface-light px-4 py-3 text-sm text-zinc-200 leading-relaxed">
                {description}
                <span className="ml-2 text-xs text-zinc-500">(${budget} USD)</span>
              </div>
            </div>

            {conversation.map((qa, i) => (
              <div key={i} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 text-[10px] font-semibold">
                    AI
                  </div>
                  <div className="rounded-xl bg-surface-light border border-border px-4 py-3 text-sm text-zinc-300 leading-relaxed">
                    {qa.question}
                  </div>
                </div>
                <div className="flex gap-3 pl-10">
                  <div className="rounded-xl bg-surface-light px-4 py-3 text-sm text-zinc-300">
                    {qa.answer}
                  </div>
                </div>
              </div>
            ))}

            {!isReady && currentQuestions.length > 0 && (
              <div className="space-y-4">
                {currentQuestions.map((q, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 text-[10px] font-semibold">
                        AI
                      </div>
                      <div className="rounded-xl bg-surface-light border border-border px-4 py-3 text-sm text-zinc-300 leading-relaxed">
                        {q}
                      </div>
                    </div>
                    <div className="pl-10">
                      <Input
                        value={answers[i] || ''}
                        onChange={(e) => {
                          const next = [...answers];
                          next[i] = e.target.value;
                          setAnswers(next);
                        }}
                        placeholder="Your answer…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && canSubmitAnswers && i === currentQuestions.length - 1) {
                            onSubmitAnswers(answers);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="rounded-xl bg-surface-light border border-border px-4 py-3 text-sm text-zinc-500">
                  Thinking…
                </div>
              </div>
            )}

            {isReady && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
                  Good to go. Review the task breakdown and create your job when ready.
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <CardFooter className="flex items-center gap-3 bg-surface/30">
            {isReady ? (
              <Button
                variant="success"
                size="lg"
                onClick={onCreateJob}
                disabled={isCreating}
                className="flex-1"
              >
                {isCreating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                ) : (
                  <><Plus className="h-4 w-4" />Create Job</>
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => onSubmitAnswers(answers)}
                disabled={!canSubmitAnswers || isLoading}
                className="flex-1"
              >
                <Send className="h-4 w-4" />
                Submit Answers
              </Button>
            )}
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </button>
          </CardFooter>
        </Card>
      </div>

      {/* Right: Live Task Preview */}
      <div className="w-full lg:w-80 shrink-0">
        <Card className="lg:sticky lg:top-20">
          <CardHeader className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-300">Task Breakdown</span>
            {isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-zinc-600 ml-auto" />
            )}
          </CardHeader>

          <CardBody className="space-y-2.5">
            {taskPreview.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-6">
                Will appear as you answer questions…
              </p>
            ) : (
              <AnimatePresence mode="popLayout">
                {taskPreview.map((task, i) => {
                  const isAi = task.executorType === 'ai';
                  return (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ delay: i * 0.04 }}
                      className={`rounded-xl border p-3 space-y-1.5 ${
                        isAi
                          ? 'border-purple-500/20 bg-purple-500/5'
                          : 'border-border bg-surface-light/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold ${
                          isAi ? 'bg-purple-500/20 text-purple-400' : 'bg-primary/15 text-primary-light'
                        }`}>
                          {isAi ? 'AI' : i + 1}
                        </span>
                        <div className="text-xs text-zinc-300 leading-snug">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="m-0">{children}</p>,
                              ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                              li: ({ children }) => <li className="my-0.5">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
                              code: ({ children }) => <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] font-mono text-purple-300">{children}</code>,
                            }}
                          >
                            {task.description}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {isAi ? (
                        <div className="pl-7 flex items-center gap-1 text-[10px] text-purple-400/80">
                          <Zap className="h-3 w-3" />
                          AI-executed
                        </div>
                      ) : (
                        <div className="pl-7 flex items-center gap-1 text-[10px] text-amber-400/80">
                          <Coins className="h-3 w-3" />
                          {task.reward} ETH
                          {ethPrice && (
                            <span className="text-zinc-600 ml-0.5">
                              (~${(parseFloat(task.reward) * (ethPrice ?? 0)).toFixed(2)})
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const { isConnected } = useAccount();
  const { createJob, isPending, isConfirming, isSuccess } = useCreateJob();
  const { ethPrice } = useEthPrice();
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');

  const [phase, setPhase] = useState<'form' | 'clarifying' | 'submitting'>('form');
  const [conversation, setConversation] = useState<QAPair[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const [taskPreview, setTaskPreview] = useState<TaskPreview[]>([]);
  const [enrichedDescription, setEnrichedDescription] = useState<string | null>(null);
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyError, setClarifyError] = useState<string | null>(null);

  const budgetNum = parseFloat(budget);
  const canStartClarify = description.length >= 10 && !isNaN(budgetNum) && budgetNum >= 1;
  const ethEquivalent = ethPrice && budgetNum > 0 ? usdToEth(budgetNum, ethPrice) : null;
  const isCreating = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      setDescription('');
      setBudget('');
      setPhase('form');
      setConversation([]);
      setCurrentQuestions([]);
      setTaskPreview([]);
      setEnrichedDescription(null);
      navigate('/jobs');
    }
  }, [isSuccess, navigate]);

  async function callClarify(convo: QAPair[]) {
    setClarifyLoading(true);
    setClarifyError(null);
    try {
      const res = await fetch(`${AGENT_API_URL}/api/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, budget, conversation: convo }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Clarification request failed');
      }
      const data = await res.json();
      if (data.taskPreview) setTaskPreview(data.taskPreview);
      if (data.ready) {
        setEnrichedDescription(data.enrichedDescription || description);
        setCurrentQuestions([]);
      } else {
        setCurrentQuestions(data.questions || []);
      }
    } catch (err: unknown) {
      setClarifyError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setClarifyLoading(false);
    }
  }

  function handleStartClarify(e: React.FormEvent) {
    e.preventDefault();
    if (!canStartClarify) return;
    setPhase('clarifying');
    setConversation([]);
    setCurrentQuestions([]);
    setTaskPreview([]);
    setEnrichedDescription(null);
    callClarify([]);
  }

  function handleSubmitAnswers(answers: string[]) {
    const newPairs = currentQuestions.map((q, i) => ({ question: q, answer: answers[i] }));
    const newConvo = [...conversation, ...newPairs];
    setConversation(newConvo);
    setCurrentQuestions([]);
    callClarify(newConvo);
  }

  function handleCreateJob() {
    if (!ethPrice) return;
    const desc = enrichedDescription || description;
    const ethAmount = usdToEth(budgetNum, ethPrice);
    createJob(desc, ethAmount);
  }

  function handleSkip() {
    if (!ethPrice) return;
    const ethAmount = usdToEth(budgetNum, ethPrice);
    createJob(description, ethAmount);
  }

  function handleBack() {
    setPhase('form');
    setConversation([]);
    setCurrentQuestions([]);
    setTaskPreview([]);
    setEnrichedDescription(null);
    setClarifyError(null);
  }

  return (
    <div className={phase === 'clarifying' ? 'mx-auto max-w-5xl' : 'mx-auto max-w-2xl'}>
      {phase === 'clarifying' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-sm text-zinc-400">Refining your job</span>
          </div>
        </motion.div>
      ) : (
        <PageHeader
          title="Post a Job"
          description="Describe what you need done and set a budget. An AI agent will break it into tasks on Base."
        />
      )}

      {!isConnected ? (
        <EmptyState
          icon={Wallet}
          title="Connect your wallet"
          description="Connect your wallet to post jobs on the Relayer marketplace."
        />
      ) : (
        <>
          {phase === 'form' && (
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onSubmit={handleStartClarify}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-white">Job Details</h2>
                </CardHeader>
                <CardBody className="space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="description" className="block text-xs font-medium text-zinc-400">
                      Description
                    </label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what you need done. Be specific (min 10 characters)."
                      rows={5}
                      minLength={10}
                    />
                    <p className="text-[11px] text-zinc-600">
                      {description.length} / 10 min characters
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="budget" className="block text-xs font-medium text-zinc-400">
                      Budget (USD)
                    </label>
                    <Input
                      id="budget"
                      type="text"
                      inputMode="decimal"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="10"
                    />
                    {ethEquivalent && (
                      <p className="text-[11px] text-zinc-500">
                        ≈ {ethEquivalent} ETH @ ${ethPrice?.toLocaleString()}/ETH
                      </p>
                    )}
                  </div>
                </CardBody>
                <CardFooter className="bg-surface/30">
                  <Button
                    type="submit"
                    disabled={!canStartClarify}
                    size="lg"
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" />
                    Submit Job
                  </Button>
                </CardFooter>
              </Card>
            </motion.form>
          )}

          {phase === 'clarifying' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
              {clarifyError && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                  {clarifyError}
                </div>
              )}
              <ClarificationView
                description={description}
                budget={budget}
                conversation={conversation}
                currentQuestions={currentQuestions}
                taskPreview={taskPreview}
                isLoading={clarifyLoading}
                isReady={!!enrichedDescription}
                onSubmitAnswers={handleSubmitAnswers}
                onCreateJob={handleCreateJob}
                onSkip={handleSkip}
                isCreating={isCreating}
                ethPrice={ethPrice}
              />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
