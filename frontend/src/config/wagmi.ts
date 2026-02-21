import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { type Chain } from "viem";

const anvilChain: Chain = {
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
};

const chainMap = {
  localhost: anvilChain,
  "base-sepolia": baseSepolia,
  base: base,
} as const;

const VITE_CHAIN = (import.meta.env.VITE_CHAIN || "localhost") as keyof typeof chainMap;
const activeChain = chainMap[VITE_CHAIN];

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const hasWalletConnect = projectId && projectId !== "placeholder-for-dev";

const wallets = hasWalletConnect
  ? [metaMaskWallet, coinbaseWallet, walletConnectWallet]
  : [metaMaskWallet, coinbaseWallet];

const connectors = connectorsForWallets(
  [{ groupName: "Connect", wallets }],
  { appName: "Relayer", projectId: projectId || "unused" },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [activeChain],
  pollingInterval: 4_000,
  transports: {
    [activeChain.id]: http(),
  },
});

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`;
export const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || "http://localhost:3001";
