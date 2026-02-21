# Relayer: Self-Sustaining AI Agent That Hires Humans

An autonomous AI agent on **Base mainnet** that takes complex real-world jobs from clients, decomposes them into sequential subtasks, hires humans to complete each step, verifies work with AI Vision, and keeps the profit margin to fund its own compute.

## Architecture

```
ETHDenver2026/
├── contracts/          # Foundry - JobMarketplace.sol
├── agent/              # TypeScript AI Agent (Express + OpenAI + AgentKit)
└── frontend/           # Vite + React + wagmi + RainbowKit
```

## Quick Start (Local Development)

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Node.js 20+
- OpenAI API key

### One-command startup

```bash
export OPENAI_API_KEY=sk-...
./dev.sh
```

This single script handles everything: starts Anvil, deploys the contract, wires up `.env` files, and launches both the agent and frontend. When it's ready you'll see:

```
  Frontend:  http://localhost:5173
  Agent API: http://localhost:3001
  Contract:  0x...
```

Press `Ctrl+C` to shut everything down cleanly.

### Test the Flow

1. Add the Anvil network to MetaMask (RPC `http://127.0.0.1:8545`, Chain ID `31337`)
2. Import a test private key into MetaMask as a **client** wallet (the script prints one)
3. Go to `http://localhost:5173/` — submit a job with a description and ETH budget
4. Import the **worker** private key, switch to it, go to `/work` — accept tasks, upload proof images
5. Watch `/dashboard` — live feed of agent actions, transactions, and profitability

### Manual startup (if you prefer)

<details>
<summary>Step-by-step</summary>

**Terminal 1** — Local chain:

```bash
anvil --chain-id 31337
```

**Terminal 2** — Deploy:

```bash
cd contracts
AGENT_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

**Terminal 2** — Agent (set `CONTRACT_ADDRESS` and `OPENAI_API_KEY` in `agent/.env`):

```bash
cd agent && cp .env.example .env && npm run dev
```

**Terminal 3** — Frontend (set `VITE_CONTRACT_ADDRESS` in `frontend/.env`):

```bash
cd frontend && cp .env.example .env && npm run dev
```

</details>

## Production Deployment

### Base Mainnet

```bash
# Deploy contract
cd contracts
AGENT_ADDRESS=<cdp-smart-wallet> PRIVATE_KEY=<deployer-key> \
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify

# Agent: deploy to Railway with env vars
# Frontend: deploy to Vercel with env vars
```

See the plan file for full environment variable reference.

## Base Track Compliance

- **Base mainnet**: Contract + agent wallet on chain 8453
- **Real financial primitives**: ETH escrow, worker payments, profit withdrawal
- **ERC-8021**: Builder code appended to every agent TX
- **Autonomous**: Decomposes jobs, verifies proofs, pays workers automatically
- **Self-sustaining**: Profit covers API + gas + hosting costs
- **x402**: AI service endpoints generate baseline revenue
- **Public dashboard**: Live URL with actions, TXs, and profitability metrics

## License

MIT
