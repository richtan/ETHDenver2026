# TaskMaster: Self-Sustaining AI Agent That Hires Humans

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
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 20+
- OpenAI API key

### 1. Start Local Chain
```bash
cd contracts
anvil --chain-id 31337
```

### 2. Deploy Contract
```bash
cd contracts
AGENT_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
forge script script/Deploy.s.sol --rpc-url localhost --broadcast
```

### 3. Start Agent
```bash
cd agent
cp .env.example .env
# Edit .env: set CONTRACT_ADDRESS from step 2, OPENAI_API_KEY
npm run dev
```

### 4. Start Frontend
```bash
cd frontend
cp .env.example .env
# Edit .env: set VITE_CONTRACT_ADDRESS from step 2
npm run dev
```

### 5. Test the Flow
1. Import Anvil account #2 into MetaMask (client wallet)
2. Go to `http://localhost:5173/` — submit a job with 0.01 ETH
3. Import Anvil account #3 into MetaMask (worker wallet)
4. Go to `/work` — accept tasks, upload proof images
5. Watch `/dashboard` — live feed of agent actions

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
