import { Outlet, NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useState } from "react";
import { Bot, Briefcase, Hammer, LayoutDashboard, User, Droplets } from "lucide-react";
import { AGENT_API_URL } from "../../config/wagmi";

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
                <Briefcase className="h-4 w-4" />
                Hire Agent
              </NavLink>
              <NavLink to="/work" className={linkClass}>
                <Hammer className="h-4 w-4" />
                Work
              </NavLink>
              <NavLink to="/my-tasks" className={linkClass}>
                <User className="h-4 w-4" />
                My Tasks
              </NavLink>
              <NavLink to="/dashboard" className={linkClass}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <FaucetButton />
            <ConnectButton showBalance={true} chainStatus="icon" accountStatus="avatar" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
