import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, LogOut, X, Link2 } from "lucide-react";
import { useState } from "react";
import { useWorkerReputation } from "../hooks/useWorkerReputation";
import { ReputationSection, TIER_CONFIG } from "./ReputationSection";
import type { ReputationTier } from "../hooks/useWorkerReputation";

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 z-[60] w-[380px] rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h3 className="text-sm font-semibold text-white">Account</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Account Info */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-800/30 p-4 space-y-3">
              {/* Chain */}
              <div className="flex items-center gap-2">
                {chainIconUrl ? (
                  <img src={chainIconUrl} alt={chainName} className="h-4 w-4 rounded-full" />
                ) : (
                  <Link2 className="h-4 w-4 text-slate-400" />
                )}
                <span className="text-xs text-slate-400">{chainName}</span>
              </div>

              {/* Address */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-white truncate flex-1">
                  {displayName}
                </span>
                <button
                  onClick={copyAddress}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 transition"
                  title="Copy address"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Balance */}
              <div className="text-lg font-bold text-white">
                {balance}
              </div>
            </div>

            {/* Reputation */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reputation</h4>
              <ReputationSection reputation={reputation ?? undefined} />

              {/* Tier explainer */}
              <div className="rounded-lg border border-slate-800/40 bg-slate-800/20 p-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Tier Bonuses</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIER_EXPLAINER.map(({ tier, label, bonus, threshold }) => {
                    const cfg = TIER_CONFIG[tier];
                    const isActive = (reputation?.tier ?? "none") === tier;
                    return (
                      <div
                        key={tier}
                        className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                          isActive ? `${cfg.bg} ${cfg.border} border` : "text-slate-500"
                        }`}
                      >
                        <span className={isActive ? cfg.color : "text-slate-500"}>{label}</span>
                        <span className={isActive ? "text-white font-medium" : "text-slate-600"}>
                          {bonus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Disconnect */}
            <button
              onClick={() => {
                onDisconnect();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:border-red-500/30"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
