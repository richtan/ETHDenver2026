import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Tag } from "lucide-react";
import { useWorkerProfile } from "../hooks/useWorkerProfile";
import { useUpdateWorkerTags } from "../hooks/useUpdateWorkerTags";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const SUGGESTED_TAGS = [
  "photography",
  "design",
  "writing",
  "data-entry",
  "research",
  "social-media",
  "video",
  "translation",
  "coding",
  "physical-labor",
];

export function WorkerProfilePanel({
  address,
  onClose,
}: {
  address: string;
  onClose: () => void;
}) {
  const { data: profile } = useWorkerProfile(address);
  const { mutate: updateTags, isPending } = useUpdateWorkerTags(address);
  const [inputValue, setInputValue] = useState("");

  const currentTags = profile?.tags ?? [];

  function addTag(tag: string) {
    const normalized = tag.toLowerCase().trim();
    if (!normalized || currentTags.includes(normalized)) return;
    updateTags([...currentTags, normalized]);
    setInputValue("");
  }

  function removeTag(tag: string) {
    updateTags(currentTags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Your Skill Tags</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-400">Your Tags</h3>
          <div className="flex flex-wrap gap-2 min-h-10">
            <AnimatePresence mode="popLayout">
              {currentTags.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-zinc-500"
                >
                  No tags yet. Add some below to get personalized task recommendations.
                </motion.p>
              ) : (
                currentTags.map((tag) => (
                  <motion.span
                    key={tag}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      disabled={isPending}
                      className="rounded-full p-0.5 transition hover:bg-emerald-500/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.span>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-400">Add Custom Tag</h3>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. graphic-design"
            />
            <Button
              variant="success"
              size="md"
              onClick={() => addTag(inputValue)}
              disabled={!inputValue.trim() || isPending}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-400">Suggested Tags</h3>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.filter((t) => !currentTags.includes(t)).map(
              (tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  disabled={isPending}
                  className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
                >
                  + {tag}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
