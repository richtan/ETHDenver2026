import { type Address, type Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';

type Network = 'localhost' | 'base-sepolia' | 'base';

interface NetworkConfig {
  chain: Chain;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: Address;
  deploymentBlock: bigint;
  walletMode: 'anvil' | 'cdp';
  erc8021Enabled: boolean;
  x402Enabled: boolean;
  reimbursementEnabled: boolean;
  priceFeedMode: 'fixed' | 'coingecko';
  fixedEthPrice: number;
}

const NETWORK = (process.env.NETWORK || 'localhost') as Network;

const anvilChain: Chain = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
};

const configs: Record<Network, NetworkConfig> = {
  localhost: {
    chain: anvilChain,
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: '',
    contractAddress: process.env.CONTRACT_ADDRESS as Address,
    deploymentBlock: 0n,
    walletMode: 'anvil',
    erc8021Enabled: !!process.env.BUILDER_CODE,
    x402Enabled: false,
    reimbursementEnabled: false,
    priceFeedMode: 'fixed',
    fixedEthPrice: 2500,
  },
  'base-sepolia': {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
    explorerUrl: 'https://sepolia.basescan.org',
    contractAddress: process.env.CONTRACT_ADDRESS as Address,
    deploymentBlock: BigInt(process.env.DEPLOYMENT_BLOCK || '0'),
    walletMode: 'anvil',
    erc8021Enabled: !!process.env.BUILDER_CODE,
    x402Enabled: false,
    reimbursementEnabled: false,
    priceFeedMode: 'coingecko',
    fixedEthPrice: 2500,
  },
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL!,
    explorerUrl: 'https://basescan.org',
    contractAddress: process.env.CONTRACT_ADDRESS as Address,
    deploymentBlock: BigInt(process.env.DEPLOYMENT_BLOCK || '0'),
    walletMode: 'cdp',
    erc8021Enabled: true,
    x402Enabled: true,
    reimbursementEnabled: true,
    priceFeedMode: 'coingecko',
    fixedEthPrice: 2500,
  },
};

export const config = configs[NETWORK];
export { NETWORK };
