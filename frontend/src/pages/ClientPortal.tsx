import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  CheckCircle2,
  Loader2,
  Plus,
  MessageCircle,
  Send,
  ListChecks,
  Coins,
  SkipForward,
} from "lucide-react";
import { useCreateJob } from "../hooks/useCreateJob";
import { AGENT_API_URL } from "../config/wagmi";

interface TaskPreview {
  description: string;
  proofRequirements: string;
  reward: string;
}

interface QAPair {
  question: string;
  answer: string;
}

/* ── Clarification conversation panel ─────────────────────────────── */

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
}) {
  const [answers, setAnswers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnswers(currentQuestions.map(() => ""));
  }, [currentQuestions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, currentQuestions, isLoading]);

  const canSubmitAnswers = answers.length > 0 && answers.every((a) => a.trim().length > 0);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left: Conversation */}
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-800/60 px-5 py-3">
            <MessageCircle className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-slate-300">
              Clarifying your job
            </span>
          </div>

          {/* Chat body */}
          <div className="max-h-[28rem] overflow-y-auto px-5 py-4 space-y-4">
            {/* Original description */}
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold">
                You
              </div>
              <div className="rounded-lg bg-slate-800/60 px-4 py-2.5 text-sm text-slate-300">
                {description}
                <span className="ml-2 text-xs text-slate-500">({budget} ETH)</span>
              </div>
            </div>

            {/* Prior Q&A pairs */}
            {conversation.map((qa, i) => (
              <div key={i} className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold">
                    AI
                  </div>
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 text-sm text-slate-300">
                    {qa.question}
                  </div>
                </div>
                <div className="flex gap-3 pl-10">
                  <div className="rounded-lg bg-slate-800/60 px-4 py-2.5 text-sm text-slate-300">
                    {qa.answer}
                  </div>
                </div>
              </div>
            ))}

            {/* Current questions (unanswered) */}
            {!isReady && currentQuestions.length > 0 && (
              <div className="space-y-4">
                {currentQuestions.map((q, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold">
                        AI
                      </div>
                      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 text-sm text-slate-300">
                        {q}
                      </div>
                    </div>
                    <div className="pl-10">
                      <input
                        type="text"
                        value={answers[i] || ""}
                        onChange={(e) => {
                          const next = [...answers];
                          next[i] = e.target.value;
                          setAnswers(next);
                        }}
                        placeholder="Your answer…"
                        className="w-full rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canSubmitAnswers && i === currentQuestions.length - 1) {
                            onSubmitAnswers(answers);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 text-sm text-slate-400">
                  Thinking…
                </div>
              </div>
            )}

            {/* Ready message */}
            {isReady && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-300">
                  I have all the details I need. Review the task breakdown and create your job when ready.
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Actions */}
          <div className="border-t border-slate-800/60 px-5 py-3 flex items-center gap-3">
            {isReady ? (
              <motion.button
                onClick={onCreateJob}
                disabled={isCreating}
                whileHover={!isCreating ? { scale: 1.01 } : {}}
                whileTap={!isCreating ? { scale: 0.99 } : {}}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 hover:shadow-emerald-500/40"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Job
                  </>
                )}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => onSubmitAnswers(answers)}
                disabled={!canSubmitAnswers || isLoading}
                whileHover={canSubmitAnswers && !isLoading ? { scale: 1.01 } : {}}
                whileTap={canSubmitAnswers && !isLoading ? { scale: 0.99 } : {}}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-blue-500/40"
              >
                <Send className="h-4 w-4" />
                Submit Answers
              </motion.button>
            )}
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </button>
          </div>
        </div>
      </div>

      {/* Right: Live Task Preview */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden lg:sticky lg:top-24">
          <div className="flex items-center gap-2 border-b border-slate-800/60 px-5 py-3">
            <ListChecks className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">
              Task Preview
            </span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-500 ml-auto" />}
          </div>

          <div className="px-5 py-4 space-y-3">
            {taskPreview.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Task breakdown will appear here…
              </p>
            ) : (
              <AnimatePresence mode="popLayout">
                {taskPreview.map((task, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-[10px] font-bold text-blue-400">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-300 leading-snug">
                        {task.description}
                      </p>
                    </div>
                    <p className="pl-7 text-xs text-slate-500 leading-relaxed">
                      {task.proofRequirements}
                    </p>
                    <div className="pl-7 flex items-center gap-1 text-xs text-amber-400">
                      <Coins className="h-3 w-3" />
                      {task.reward} ETH
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */

export default function ClientPortal() {
  const { isConnected } = useAccount();
  const { createJob, isPending, isConfirming, isSuccess } = useCreateJob();
  const navigate = useNavigate();

  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");

  // Clarification state
  const [phase, setPhase] = useState<"form" | "clarifying" | "submitting">("form");
  const [conversation, setConversation] = useState<QAPair[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const [taskPreview, setTaskPreview] = useState<TaskPreview[]>([]);
  const [enrichedDescription, setEnrichedDescription] = useState<string | null>(null);
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyError, setClarifyError] = useState<string | null>(null);

  const budgetNum = parseFloat(budget);
  const canStartClarify =
    description.length >= 10 &&
    !isNaN(budgetNum) &&
    budgetNum >= 0.001;
  const isCreating = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      setDescription("");
      setBudget("");
      setPhase("form");
      setConversation([]);
      setCurrentQuestions([]);
      setTaskPreview([]);
      setEnrichedDescription(null);
      navigate("/jobs");
    }
  }, [isSuccess, navigate]);

  async function callClarify(convo: QAPair[]) {
    setClarifyLoading(true);
    setClarifyError(null);
    try {
      const res = await fetch(`${AGENT_API_URL}/api/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, budget, conversation: convo }),
      });
      if (!res.ok) throw new Error("Clarification request failed");
      const data = await res.json();
      if (data.taskPreview) setTaskPreview(data.taskPreview);
      if (data.ready) {
        setEnrichedDescription(data.enrichedDescription || description);
        setCurrentQuestions([]);
      } else {
        setCurrentQuestions(data.questions || []);
      }
    } catch (err: any) {
      setClarifyError(err.message);
    } finally {
      setClarifyLoading(false);
    }
  }

  function handleStartClarify(e: React.FormEvent) {
    e.preventDefault();
    if (!canStartClarify) return;
    setPhase("clarifying");
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
    const desc = enrichedDescription || description;
    createJob(desc, budget);
  }

  function handleSkip() {
    createJob(description, budget);
  }

  function handleBack() {
    setPhase("form");
    setConversation([]);
    setCurrentQuestions([]);
    setTaskPreview([]);
    setEnrichedDescription(null);
    setClarifyError(null);
  }

  return (
    <div className={phase === "clarifying" ? "mx-auto max-w-5xl" : "mx-auto max-w-3xl"}>
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
          {phase === "form" && (
            <motion.form
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleStartClarify}
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
                  disabled={!canStartClarify}
                  whileHover={canStartClarify ? { scale: 1.01 } : {}}
                  whileTap={canStartClarify ? { scale: 0.99 } : {}}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white shadow-lg shadow-blue-500/25 transition disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-blue-500/40"
                >
                  <Plus className="h-5 w-5" />
                  Submit Job
                </motion.button>
              </div>
            </motion.form>
          )}

          {phase === "clarifying" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="text-sm text-slate-500 hover:text-slate-300 transition"
                >
                  &larr; Back
                </button>
                <h2 className="text-lg font-semibold text-white">
                  Refining your job
                </h2>
              </div>

              {clarifyError && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
              />
            </motion.div>
          )}

        </>
      )}
    </div>
  );
}
