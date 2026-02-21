import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, LogOut, X, Link2, Droplets } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useWorkerReputation } from "../hooks/useWorkerReputation";
import { ReputationSection, TIER_CONFIG } from "./ReputationSection";
import type { ReputationTier } from "../hooks/useWorkerReputation";
import { Button } from "./ui/button";
import { AGENT_API_URL } from "../config/wagmi";

const IS_LOCAL = import.meta.env.VITE_CHAIN === "localhost";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  displayName: string;
  balance: string;
  chainName: string;
  chainIconUrl?: string;
  onDisconnect: () => void;
}

const TIER_EXPLAINER: { tier: ReputationTier; label: string; bonus: string; threshold: string }[] = [
  { tier: "gold", label: "Gold", bonus: "+10%", threshold: "≥ 0.85 score" },
  { tier: "silver", label: "Silver", bonus: "+5%", threshold: "≥ 0.70 score" },
  { tier: "bronze", label: "Bronze", bonus: "+2%", threshold: "≥ 0.50 score" },
  { tier: "none", label: "Unranked", bonus: "0%", threshold: "< 0.50 score" },
];

export function WalletModal({
  open,
  onClose,
  address,
  displayName,
  balance,
  chainName,
  chainIconUrl,
  onDisconnect,
}: WalletModalProps) {
  const [copied, setCopied] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetSent, setFaucetSent] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { data: reputation } = useWorkerReputation(address);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function drip() {
    setFaucetLoading(true);
    try {
      const res = await fetch(`${AGENT_API_URL}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (res.ok) setFaucetSent(true);
    } finally {
      setFaucetLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 z-60 w-[380px] rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h3 className="text-sm font-semibold text-white">Account</h3>
            <button
              onClick={onClose}
              className="rounded-xl p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-800/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {chainIconUrl ? (
                  <img src={chainIconUrl} alt={chainName} className="h-4 w-4 rounded-full" />
                ) : (
                  <Link2 className="h-4 w-4 text-zinc-400" />
                )}
                <span className="text-xs text-zinc-400">{chainName}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-white truncate flex-1">
                  {displayName}
                </span>
                <button
                  onClick={copyAddress}
                  className="shrink-0 rounded-xl p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition"
                  title="Copy address"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="text-lg font-bold text-white">{balance}</div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Reputation</h4>
              <ReputationSection reputation={reputation ?? undefined} />

              <div className="rounded-xl border border-zinc-800/40 bg-zinc-800/20 p-3">
                <p className="text-xs font-medium text-zinc-500 mb-2">Tier Bonuses</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIER_EXPLAINER.map(({ tier, label, bonus }) => {
                    const cfg = TIER_CONFIG[tier];
                    const isActive = (reputation?.tier ?? "none") === tier;
                    return (
                      <div
                        key={tier}
                        className={`flex items-center justify-between rounded-xl px-2 py-1 text-xs ${
                          isActive ? `${cfg.bg} ${cfg.border} border` : "text-zinc-500"
                        }`}
                      >
                        <span className={isActive ? cfg.color : "text-zinc-500"}>{label}</span>
                        <span className={isActive ? "text-white font-medium" : "text-zinc-600"}>
                          {bonus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Button
              variant="danger"
              size="md"
              className="w-full"
              onClick={() => {
                onDisconnect();
                onClose();
              }}
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>

            {IS_LOCAL && (
              <button
                onClick={drip}
                disabled={faucetLoading || faucetSent}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10 hover:border-emerald-500/30 disabled:opacity-50"
              >
                <Droplets className="h-4 w-4" />
                {faucetSent ? "10 ETH sent!" : faucetLoading ? "Sending…" : "Get Test ETH"}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
