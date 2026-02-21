# Mainnet (Base) `.env` Reference

Use these variables when running on **Base mainnet** (`chainId: 8453`). Replace placeholder values with your own secrets and deployed contract address.

---

## Agent — `agent/.env`

```env
# Network
NETWORK=base
BASE_RPC_URL=https://mainnet.base.org
CONTRACT_ADDRESS=0x...
DEPLOYMENT_BLOCK=0

# Wallet (mainnet uses Coinbase Developer Platform)
AGENT_PRIVATE_KEY=
CDP_API_KEY_ID=your-cdp-api-key-id
CDP_API_KEY_SECRET=your-cdp-api-key-secret
CDP_WALLET_SECRET=your-cdp-wallet-secret

# OpenAI
OPENAI_API_KEY=sk-...

# Pinata (IPFS)
PINATA_JWT=your-pinata-jwt
PINATA_GATEWAY=https://gateway.pinata.cloud

# Mainnet-only
OPERATOR_WALLET_ADDRESS=0x...
BUILDER_CODE=hex-bytes-without-0x-prefix

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Server
PORT=3001
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NETWORK` | Yes | Set to `base` for Base mainnet. |
| `BASE_RPC_URL` | Yes | Base mainnet RPC (e.g. `https://mainnet.base.org` or Alchemy/Infura URL). |
| `CONTRACT_ADDRESS` | Yes | Deployed TaskMaster contract on Base mainnet. |
| `DEPLOYMENT_BLOCK` | No | Block number at deployment (for indexing); default `0`. |
| `CDP_API_KEY_ID` | Yes (mainnet) | Coinbase Developer Platform API key ID. |
| `CDP_API_KEY_SECRET` | Yes (mainnet) | Coinbase Developer Platform API key secret. |
| `CDP_WALLET_SECRET` | Yes (mainnet) | Coinbase Developer Platform wallet secret. |
| `OPENAI_API_KEY` | Yes | OpenAI API key for the agent. |
| `PINATA_JWT` | No | Pinata JWT for IPFS uploads. |
| `PINATA_GATEWAY` | No | Pinata gateway URL; default `https://gateway.pinata.cloud`. |
| `OPERATOR_WALLET_ADDRESS` | Yes (mainnet) | Operator wallet address for payouts. |
| `BUILDER_CODE` | Yes (mainnet) | ERC-8021 builder code as hex bytes **without** `0x` prefix. |
| `SUPABASE_URL` | No | Supabase project URL. |
| `SUPABASE_ANON_KEY` | No | Supabase anon key. |
| `PORT` | No | Agent API port; default `3001`. |

---

## Frontend — `frontend/.env`

```env
VITE_CHAIN=base
VITE_CONTRACT_ADDRESS=0x...
VITE_AGENT_API_URL=https://your-agent-api.example.com
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
VITE_PINATA_JWT=your-pinata-jwt
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CHAIN` | Yes | Set to `base` for Base mainnet. |
| `VITE_CONTRACT_ADDRESS` | Yes | Same contract address as in `agent/.env`. |
| `VITE_AGENT_API_URL` | Yes | Public URL of the agent API (e.g. production API or tunnel). |
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID (get one at [WalletConnect Cloud](https://cloud.walletconnect.com)). |
| `VITE_PINATA_JWT` | No | Pinata JWT if frontend uploads to IPFS. |
| `VITE_PINATA_GATEWAY` | No | Pinata gateway URL. |
| `VITE_SUPABASE_URL` | No | Same Supabase URL as agent. |
| `VITE_SUPABASE_ANON_KEY` | No | Same Supabase anon key as agent. |

---

## Quick checklist

- [ ] Deploy contract to Base mainnet and set `CONTRACT_ADDRESS` / `VITE_CONTRACT_ADDRESS`.
- [ ] Set `BASE_RPC_URL` (and optional `DEPLOYMENT_BLOCK`).
- [ ] Configure CDP credentials: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`.
- [ ] Set `OPERATOR_WALLET_ADDRESS` and `BUILDER_CODE` for mainnet agent.
- [ ] Use a real `VITE_WALLETCONNECT_PROJECT_ID` (no `placeholder-for-dev`).
- [ ] Point `VITE_AGENT_API_URL` to your deployed agent API URL.
