import { Outlet, NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useState } from "react";
import { Bot, Briefcase, Hammer, LayoutDashboard, User, Droplets, Plus, ChevronDown } from "lucide-react";
import { AGENT_API_URL } from "../../config/wagmi";
import { WalletModal } from "../WalletModal";

const IS_LOCAL = import.meta.env.VITE_CHAIN === "localhost";

function FaucetButton() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!IS_LOCAL || !isConnected) return null;

  const drip = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_API_URL}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (res.ok) setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={drip}
      disabled={loading || sent}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 transition-all disabled:opacity-50"
    >
      <Droplets className="h-3.5 w-3.5" />
      {sent ? "10 ETH sent!" : loading ? "Sending..." : "Get Test ETH"}
    </button>
  );
}

function CustomWalletButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const { disconnect } = useDisconnect();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted }) => {
        const connected = mounted && account && chain;

        return (
          <div className="relative">
            {!connected ? (
              <button
                onClick={openConnectModal}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500"
              >
                Connect Wallet
              </button>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  {chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-400 border border-red-500/30"
                    >
                      Wrong network
                    </button>
                  ) : (
                    <button
                      onClick={openChainModal}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2.5 py-2 text-xs text-slate-300 transition hover:bg-slate-800 hover:border-slate-600"
                    >
                      {chain.iconUrl && (
                        <img src={chain.iconUrl} alt={chain.name ?? ""} className="h-4 w-4 rounded-full" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setModalOpen(!modalOpen)}
                    className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-2 text-sm text-white transition hover:bg-slate-800 hover:border-slate-600"
                  >
                    <span className="text-xs text-slate-400">{account.balanceFormatted ? `${Number(account.balanceFormatted).toFixed(4)} ${account.balanceSymbol}` : ""}</span>
                    <span className="font-medium">{account.displayName}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${modalOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <WalletModal
                  open={modalOpen}
                  onClose={() => setModalOpen(false)}
                  address={account.address}
                  displayName={account.address}
                  balance={account.balanceFormatted ? `${Number(account.balanceFormatted).toFixed(4)} ${account.balanceSymbol}` : "0 ETH"}
                  chainName={chain.name ?? "Unknown"}
                  chainIconUrl={chain.iconUrl}
                  onDisconnect={disconnect}
                />
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

export default function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-blue-600/20 text-blue-400 shadow-sm shadow-blue-500/10"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
    }`;

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0a0e1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                TaskMaster
              </span>
            </NavLink>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" className={linkClass} end>
                <Plus className="h-4 w-4" />
                Post Job
              </NavLink>
              <NavLink to="/jobs" className={linkClass}>
                <Briefcase className="h-4 w-4" />
                My Jobs
              </NavLink>
              <NavLink to="/work" className={linkClass}>
                <Hammer className="h-4 w-4" />
                Marketplace
              </NavLink>
              <NavLink to="/my-tasks" className={linkClass}>
                <User className="h-4 w-4" />
                My Work
              </NavLink>
              <NavLink to="/dashboard" className={linkClass}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <FaucetButton />
            <CustomWalletButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
