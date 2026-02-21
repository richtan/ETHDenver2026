import { Outlet, NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";
import { useState } from "react";
import { Briefcase, Hammer, LayoutDashboard, User, Plus, ChevronDown } from "lucide-react";
import { WalletModal } from "../WalletModal";

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
                className="h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white shadow-sm shadow-primary/20 transition hover:bg-primary-dark"
              >
                Connect Wallet
              </button>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  {chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 border border-red-500/20"
                    >
                      Wrong network
                    </button>
                  ) : (
                    <button
                      onClick={openChainModal}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                    >
                      {chain.iconUrl && (
                        <img src={chain.iconUrl} alt={chain.name ?? ""} className="h-4 w-4 rounded-full" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setModalOpen(!modalOpen)}
                    className="flex items-center gap-2.5 h-9 rounded-xl border border-border bg-card px-3.5 text-sm transition hover:border-zinc-700 hover:bg-card-hover"
                  >
                    <span className="text-[11px] font-mono text-zinc-500">
                      {account.balanceFormatted ? `${Number(account.balanceFormatted).toFixed(3)} ${account.balanceSymbol}` : ""}
                    </span>
                    <span className="text-xs font-medium text-zinc-200">{account.displayName}</span>
                    <ChevronDown className={`h-3 w-3 text-zinc-600 transition-transform duration-200 ${modalOpen ? "rotate-180" : ""}`} />
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

const NAV_ITEMS = [
  { to: "/", label: "Post Job", icon: Plus, end: true },
  { to: "/jobs", label: "My Jobs", icon: Briefcase, end: false },
  { to: "/work", label: "Marketplace", icon: Hammer, end: false },
  { to: "/my-tasks", label: "My Work", icon: User, end: false },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: false },
];

export default function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
      isActive
        ? "text-white bg-white/[0.08]"
        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
    }`;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <NavLink to="/" className="group flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center">
                {/* Glow */}
                <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md transition-all group-hover:bg-primary/30" />
                {/* Mark */}
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  className="relative h-8 w-8"
                  aria-hidden="true"
                >
                  <rect width="32" height="32" rx="8" className="fill-primary" />
                  {/* Relay node paths */}
                  <circle cx="10" cy="11" r="2.5" fill="white" fillOpacity="0.9" />
                  <circle cx="22" cy="11" r="2.5" fill="white" fillOpacity="0.9" />
                  <circle cx="16" cy="22" r="2.5" fill="white" fillOpacity="0.9" />
                  <path d="M12 12.5L14.5 20" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M20 12.5L17.5 20" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12.5 11H19.5" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-[15px] font-bold tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}>
                Relayer
              </span>
            </NavLink>

            <div className="hidden md:block h-5 w-px bg-border/60" />

            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} className={linkClass} end={end}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
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
