# AgentWork: Autonomous AI-Coordinated Human Task Marketplace on Base

## Project Overview

AgentWork is a fully autonomous AI agent system deployed on Base mainnet that earns revenue by acting as an intelligent labor marketplace coordinator. The core concept: **AI agents identify real-world micro-tasks that humans can physically complete, post them onchain, autonomously match and pay verified human workers, and charge a platform fee — funding their own compute and turning a profit.**

This inverts the typical AI narrative. Rather than AI replacing humans, here AI _employs_ humans for tasks it literally cannot do (physical presence, local knowledge, dexterity), while humans cannot match the AI's speed, efficiency, or trustless payment execution.

**Why this wins:**

- Novel revenue model: AI generates real profit by coordinating human labor
- Self-sustaining: platform fees > compute costs, demonstrable onchain
- Deeply integrated with Base primitives: ERC-8021, EIP-8004 reputation, X402 payments
- Fully autonomous agent loop with zero human intervention on the agent side
- Real economic activity, not simulation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgentWork System                          │
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  AI Agent   │───▶│  Base Smart  │◀───│  Human Workers   │   │
│  │  Orchestr.  │    │  Contracts   │    │  (Mobile/Web UI) │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│         │                  │                     │               │
│         ▼                  ▼                     ▼               │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Task Intel │    │  EIP-8004    │    │  Proof Verif.    │   │
│  │  Engine     │    │  Reputation  │    │  (Photo/GPS/NFC) │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│         │                                        │               │
│         └──────────────────────────────────────▶│               │
│                    Public Dashboard               │               │
│              (Agent Actions / Analytics)          │               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Smart Contract Architecture

### 1. `AgentWorkRegistry.sol`

The central registry contract deployed on Base mainnet.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC8021.sol";
import "./interfaces/IEIP8004.sol";

contract AgentWorkRegistry is IERC8021 {
    // ERC-8021 builder code embedded in every transaction
    bytes32 public constant BUILDER_CODE = /* registered via base.dev */;

    struct Task {
        uint256 taskId;
        address agentAddress;       // The AI agent that posted this task
        string taskType;            // "delivery", "photo_survey", "verification", "data_collection"
        string description;
        string locationHash;        // IPFS hash of encrypted location data
        uint256 rewardWei;          // Payment in ETH (Base)
        uint256 platformFeeWei;     // Agent's cut (typically 15-25%)
        uint256 deadline;
        TaskStatus status;
        address assignedWorker;
        bytes32 proofHash;          // IPFS hash of completion proof
        uint256 postedAt;
    }

    enum TaskStatus { Open, Assigned, UnderVerification, Completed, Disputed, Cancelled }

    mapping(uint256 => Task) public tasks;
    mapping(address => uint256[]) public workerTaskHistory;
    mapping(address => uint256) public agentRevenue;

    uint256 public totalTasksCompleted;
    uint256 public totalVolumeProcessed;

    // X402 payment channel support
    mapping(address => uint256) public x402Credits;

    event TaskPosted(uint256 indexed taskId, address indexed agent, uint256 reward);
    event TaskAssigned(uint256 indexed taskId, address indexed worker);
    event TaskCompleted(uint256 indexed taskId, address indexed worker, uint256 payment);
    event AgentRevenueAccrued(address indexed agent, uint256 amount);

    function postTask(
        string calldata taskType,
        string calldata description,
        string calldata locationHash,
        uint256 rewardWei,
        uint256 deadline
    ) external payable returns (uint256 taskId) {
        // msg.value must cover reward + platform fee
        // Platform fee goes to agent's revenue pool
        // ERC-8021 builder code included in calldata
    }

    function assignTask(uint256 taskId, address worker) external {
        // Called autonomously by AI agent
        // Verifies worker EIP-8004 reputation score
        // Locks reward in escrow
    }

    function submitProof(uint256 taskId, bytes32 proofHash) external {
        // Called by human worker
        // Triggers AI verification process
    }

    function releasePayment(uint256 taskId) external {
        // Called by AI agent after verification
        // Pays worker, accrues platform fee to agent
        // Updates EIP-8004 reputation for worker
    }

    function withdrawAgentRevenue() external {
        // Agent withdraws accumulated fees to pay compute costs
    }
}
```

### 2. `ReputationOracle.sol`

EIP-8004 compatible reputation tracking.

```solidity
contract ReputationOracle {
    struct WorkerProfile {
        uint256 tasksCompleted;
        uint256 tasksDisputed;
        uint256 averageCompletionTimeSeconds;
        uint256 reputationScore;        // 0-1000
        string[] specializations;       // task types worker excels at
        uint256 totalEarned;
        bool isActive;
    }

    mapping(address => WorkerProfile) public profiles;

    // EIP-8004: Onchain reputation attestations
    function updateReputation(
        address worker,
        bool taskSuccess,
        uint256 completionTime,
        string calldata taskType
    ) external onlyRegistry {
        // Algorithmic reputation update
        // Success: +score based on speed and task type
        // Failure/dispute: -score with decay
    }

    function getWorkerScore(address worker) external view returns (uint256) {}

    function getOptimalWorker(
        address[] calldata candidates,
        string calldata taskType,
        bytes32 locationHash
    ) external view returns (address bestWorker, uint256 score) {}
}
```

### 3. `AgentTreasury.sol`

Manages agent's finances: pays for Coinbase CDP compute, tracks P&L.

```solidity
contract AgentTreasury {
    address public immutable agentAddress;

    uint256 public totalRevenue;
    uint256 public totalComputeCosts;
    uint256 public totalWorkerPayments;

    // X402 micropayment channel for compute costs
    address public computeProvider;  // Coinbase CDP endpoint

    function recordRevenue(uint256 amount) external onlyRegistry {}
    function payComputeCost(uint256 amount) external onlyAgent {}

    function isProfitable() external view returns (bool) {
        return totalRevenue > totalComputeCosts;
    }

    function profitMargin() external view returns (int256) {
        return int256(totalRevenue) - int256(totalComputeCosts);
    }
}
```

---

## AI Agent Architecture (Python / Coinbase AgentKit)

### Agent Stack

- **Runtime**: Python 3.11+
- **Framework**: Coinbase AgentKit + LangChain
- **LLM**: Claude claude-sonnet-4-6 via Anthropic API
- **Blockchain**: Base mainnet via Coinbase CDP
- **Compute Funding**: X402 micropayment channel — agent pays per API call from its onchain treasury

### Core Agent Loop

```python
# agent/core/orchestrator.py

import asyncio
from coinbase_agentkit import AgentKit, CDPWallet
from anthropic import Anthropic
from web3 import Web3

class AgentWorkOrchestrator:
    """
    Main autonomous agent loop. Runs 24/7 with no human intervention.
    Cycle: Discover opportunities → Post tasks → Match workers → Verify → Pay → Profit
    """

    def __init__(self):
        self.agentkit = AgentKit(network="base-mainnet")
        self.wallet = CDPWallet.load_or_create("agentwork_wallet")
        self.anthropic = Anthropic()
        self.w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
        self.registry = self.w3.eth.contract(
            address=REGISTRY_ADDRESS,
            abi=REGISTRY_ABI
        )

    async def run_forever(self):
        """Main autonomous loop — runs indefinitely"""
        while True:
            try:
                await self.discover_and_post_tasks()
                await self.process_pending_assignments()
                await self.verify_completions()
                await self.manage_treasury()
                await asyncio.sleep(60)  # 1-minute cycle
            except Exception as e:
                self.log_error(e)
                await asyncio.sleep(30)

    async def discover_and_post_tasks(self):
        """
        Agent uses Claude to identify profitable task opportunities.
        Data sources: local business APIs, community boards, delivery platforms,
        property inspection requests, survey companies, mystery shopping networks.
        """
        opportunities = await self.scan_task_opportunities()

        for opp in opportunities:
            # Claude evaluates profitability and feasibility
            analysis = await self.evaluate_opportunity(opp)

            if analysis["expected_profit_margin"] > 0.15:  # >15% margin
                task_params = await self.structure_task(opp, analysis)
                await self.post_task_onchain(task_params)

    async def evaluate_opportunity(self, opportunity: dict) -> dict:
        """Claude evaluates task ROI before posting"""
        response = self.anthropic.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=TASK_EVALUATION_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Evaluate this task opportunity: {opportunity}"
            }]
        )
        return parse_evaluation(response.content[0].text)

    async def match_worker_to_task(self, task_id: int) -> str:
        """
        Fully autonomous worker selection using EIP-8004 reputation.
        No human decides — agent picks optimal worker algorithmically.
        """
        available_workers = await self.get_available_workers(task_id)

        scores = []
        for worker in available_workers:
            reputation = await self.registry.functions.getWorkerScore(worker).call()
            proximity_score = await self.calculate_proximity(worker, task_id)
            bid = await self.get_worker_bid(worker, task_id)

            # Weighted scoring: reputation 40%, proximity 35%, cost 25%
            composite_score = (
                reputation * 0.40 +
                proximity_score * 0.35 +
                (1 / (bid + 1)) * 1000 * 0.25
            )
            scores.append((worker, composite_score))

        best_worker = max(scores, key=lambda x: x[1])[0]

        # Assign onchain — autonomous transaction signed by agent wallet
        tx = await self.registry.functions.assignTask(
            task_id, best_worker
        ).build_transaction({
            "from": self.wallet.address,
            "gas": 200000,
            "data": encode_with_builder_code(BUILDER_CODE)
        })
        await self.wallet.sign_and_send(tx)

        return best_worker

    async def verify_completion(self, task_id: int, proof_hash: str) -> bool:
        """
        AI verifies human's proof of task completion.
        Uses vision model to analyze photos, cross-references GPS data.
        """
        proof_data = await ipfs_fetch(proof_hash)

        # Claude vision for photo verification
        if proof_data.get("photos"):
            verification = self.anthropic.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=200,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": proof_data["photos"][0]
                            }
                        },
                        {
                            "type": "text",
                            "text": f"Verify this photo proves completion of task: {proof_data['task_description']}. Respond YES or NO with brief reasoning."
                        }
                    ]
                }]
            )
            verified = "YES" in verification.content[0].text.upper()

        if proof_data.get("gps_coordinates"):
            verified = verified and self.validate_gps(
                proof_data["gps_coordinates"],
                proof_data["required_location"]
            )

        if verified:
            await self.release_payment_onchain(task_id)
            await self.update_worker_reputation(task_id, success=True)

        return verified

    async def manage_treasury(self):
        """
        Agent pays its own compute costs from earned revenue.
        Uses X402 micropayment channel to pay Anthropic API costs.
        """
        treasury_state = await self.get_treasury_state()

        if treasury_state["pending_compute_bill"] > 0:
            await self.pay_compute_x402(treasury_state["pending_compute_bill"])

        await self.log_sustainability_metrics(treasury_state)
```

### Task Discovery Engine

```python
# agent/tasks/discovery.py

class TaskDiscoveryEngine:
    """
    Scans multiple sources for tasks that require human physical presence.
    AI cannot do these — that's the whole point.
    """

    TASK_SOURCES = [
        "local_business_verification",   # "Is this restaurant still open/accurate on maps?"
        "property_photo_surveys",        # Real estate agents need exterior photos
        "mystery_shopping_networks",     # Retailers pay for compliance checks
        "last_mile_delivery_gaps",       # Small tasks delivery apps won't take
        "community_verification",        # Neighborhood watch type tasks
        "retail_shelf_audits",          # CPG companies need shelf compliance data
        "signage_verification",          # "Is our billboard still up?"
        "accessibility_audits",          # ADA compliance spot checks
    ]

    async def price_task(self, task: dict) -> dict:
        """
        Dynamic pricing based on urgency, location difficulty,
        task complexity, and current worker supply.
        """
        base_price = TASK_BASE_PRICES[task["type"]]
        multipliers = await self.calculate_multipliers(task)

        worker_payment = base_price * multipliers["total"]
        platform_fee = worker_payment * PLATFORM_FEE_RATE  # 20%
        total_cost_to_requester = worker_payment + platform_fee

        return {
            "worker_payment_eth": worker_payment,
            "platform_fee_eth": platform_fee,
            "total_eth": total_cost_to_requester,
            "expected_profit_margin": platform_fee / total_cost_to_requester
        }
```

---

## Human Worker Interface

### Mobile/Web App (Next.js + wagmi)

**Stack**: Next.js 14, TailwindCSS, wagmi/viem, RainbowKit wallet connection, IPFS for proof upload

```
/app
  /worker
    page.tsx              - Worker dashboard: available tasks, earnings, reputation
    /tasks
      [id]/page.tsx       - Task detail: accept, navigate, submit proof
    /profile
      page.tsx            - EIP-8004 reputation score, task history, earnings
  /dashboard              - Public analytics dashboard (agent actions, P&L)
  /api
    /tasks                - REST API for mobile-friendly task fetching
    /proof                - Proof upload endpoint (→ IPFS)
```

**Worker Flow:**

1. Worker connects wallet (Base network)
2. Browses open tasks sorted by proximity and earning potential
3. Accepts task → worker address registered onchain by agent
4. Navigates to location (Google Maps deep link)
5. Completes task, submits proof (photos + GPS via browser API)
6. AI agent verifies within 60 seconds
7. Payment auto-released to worker wallet in ETH
8. Reputation score updated onchain (EIP-8004)

**Key Worker UI Components:**

- `TaskCard`: shows task type, location (obfuscated until accepted), reward, deadline
- `ProofSubmitter`: camera + GPS capture, IPFS upload, onchain proof hash submission
- `ReputationBadge`: EIP-8004 score display with breakdown
- `EarningsTracker`: historical payments, pending amounts

---

## Public Dashboard

### Live URL: `agentwork.base.app`

**Sections:**

**1. Agent Actions Feed** — Real-time stream of autonomous agent actions: task discovery, worker assignments (with reasoning), verification results, payment releases, treasury management.

**2. Transaction History** — Full onchain tx log with Etherscan links, ERC-8021 builder code confirmation, gas costs, timestamps.

**3. Performance Analytics** — Tasks posted/completed/disputed, average completion time, worker reputation distribution, geographic heat map, task type breakdown.

**4. Profitability / Sustainability Metrics**

```
┌─────────────────────────────────────────────┐
│  Total Revenue:             0.847 ETH        │
│  Compute Costs:             0.203 ETH        │
│  Net Profit:                0.644 ETH        │
│  Profit Margin:             76.1%            │
│  Self-Sustaining:           YES              │
│                                              │
│  Tasks Completed:           312              │
│  Active Workers:            47               │
│  Avg Worker Earnings:       0.0018 ETH/task  │
│  Uptime:                    99.2%            │
└─────────────────────────────────────────────┘
```

---

## ERC-8021 & Standards Integration

### ERC-8021 Builder Code

Every transaction from the agent or registry includes the ERC-8021 builder code in calldata. Enforced at the contract level — any tx without the code reverts.

```solidity
bytes4 constant BUILDER_CODE = 0x[REGISTERED_CODE]; // registered at base.dev

function _encodeWithBuilderCode(bytes memory data) internal pure returns (bytes memory) {
    return abi.encodePacked(BUILDER_CODE, data);
}
```

### EIP-8004 Reputation

Worker reputation is a first-class onchain primitive stored in `ReputationOracle.sol`. Agent reads scores before every assignment. High-rep workers get premium tasks and higher payments. Composable with other Base ecosystem reputation systems.

### X402 Payments

The agent uses X402 HTTP micropayment protocol to pay for Claude API compute costs, IPFS pinning, and oracle data feeds — creating a tight loop: **agent earns ETH → pays compute in ETH → remains profitable onchain.**

---

## Deployment

### Smart Contracts

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Deploy to Base mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_MAINNET_RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Agent Backend

```bash
pip install coinbase-agentkit anthropic web3 fastapi uvicorn ipfshttpclient

# Required env vars
export ANTHROPIC_API_KEY=...
export CDP_API_KEY_NAME=...
export CDP_API_KEY_PRIVATE_KEY=...
export BASE_MAINNET_RPC=https://mainnet.base.org
export REGISTRY_CONTRACT_ADDRESS=0x...

# Run agent
python -m agent.core.orchestrator

# Dashboard API
uvicorn agent.api.server:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
npm install
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=8453
vercel --prod
```

---

## Revenue Model & Self-Sustainability

### Revenue Streams

1. **Platform fee per task**: 20% of task value (primary)
2. **Premium worker placement**: High-rep workers pay 0.001 ETH/month for priority
3. **Business subscriptions**: Recurring-task businesses pay monthly ETH fee

### Unit Economics

- Average task value: 0.002 ETH (~$5)
- Platform fee per task: 0.0004 ETH (~$1)
- Cost per task (Claude API + gas + IPFS): ~$0.005
- **Margin per task: ~99.5%**
- Break-even: ~50 tasks/month covers hosting
- At 300 tasks/month: ~$300 net profit

### Onchain Sustainability Proof (verifiable by anyone)

```
AgentTreasury.totalRevenue        → all fees ever collected
AgentTreasury.totalComputeCosts   → all compute payments made
AgentTreasury.isProfitable()      → boolean: is agent solvent?
AgentTreasury.profitMargin()      → current margin in wei
```

---

## File Structure

```
agentwork/
├── contracts/
│   ├── src/
│   │   ├── AgentWorkRegistry.sol
│   │   ├── ReputationOracle.sol
│   │   ├── AgentTreasury.sol
│   │   └── interfaces/
│   │       ├── IERC8021.sol
│   │       └── IEIP8004.sol
│   ├── script/Deploy.s.sol
│   ├── test/AgentWorkRegistry.t.sol
│   └── foundry.toml
├── agent/
│   ├── core/
│   │   ├── orchestrator.py       # Main autonomous loop
│   │   ├── wallet.py             # CDP wallet management
│   │   └── chain.py              # Web3 contract interactions
│   ├── tasks/
│   │   ├── discovery.py          # Task opportunity scanning
│   │   ├── pricing.py            # Dynamic task pricing
│   │   └── verification.py       # AI proof verification (vision)
│   ├── workers/
│   │   ├── matching.py           # Autonomous worker selection
│   │   └── reputation.py         # EIP-8004 reputation management
│   ├── treasury/
│   │   ├── manager.py            # Revenue/cost tracking
│   │   └── x402.py               # X402 compute payment channel
│   ├── api/
│   │   └── server.py             # FastAPI for dashboard
│   └── config.py
├── frontend/
│   ├── app/
│   │   ├── dashboard/page.tsx    # Public analytics dashboard
│   │   └── worker/
│   │       ├── page.tsx          # Task browser
│   │       └── tasks/[id]/page.tsx
│   ├── components/
│   │   ├── AgentActionsFeed.tsx
│   │   ├── SustainabilityMetrics.tsx
│   │   ├── TaskCard.tsx
│   │   ├── ProofSubmitter.tsx
│   │   └── ReputationBadge.tsx
│   ├── hooks/useRegistry.ts
│   └── wagmi.config.ts
└── README.md
```

---

## Key Implementation Notes for AI Agents Building This

1. **ERC-8021 registration**: Register at `base.dev` before deploying to get your builder code bytes4. Hardcode it into `AgentWorkRegistry.sol` as a constant.

2. **CDP Wallet setup**: Use `coinbase-agentkit` Python SDK. Create wallet on Base mainnet, fund it with ETH for gas + initial task escrow deposits. The wallet address becomes the `agentAddress` in the registry.

3. **Contract deployment order**: Deploy `ReputationOracle` first → `AgentTreasury` → `AgentWorkRegistry` (constructor takes other two addresses).

4. **IPFS for proofs**: Use Pinata or Web3.Storage. Store IPFS CIDs onchain as `bytes32` using `keccak256(abi.encodePacked(cid))` for fixed-size storage.

5. **X402 compute payments**: Track API costs in a local DB, batch-settle to chain every 10 minutes to minimize gas while maintaining verifiability. Each settlement is a `payComputeCost()` call on `AgentTreasury`.

6. **Worker GPS privacy**: Hash GPS coordinates before storing onchain. Agent verifies proximity off-chain before calling `releasePayment()` — only the boolean result goes onchain.

7. **Autonomous loop robustness**: Implement exponential backoff for RPC failures. Cache pending task state in SQLite for crash recovery. Use Alchemy webhooks or polling for proof submission events.

8. **Proof of autonomy for judges**: Log every agent decision (assignment rationale, verification result, treasury action) with a structured JSON payload hashed and stored onchain. Proves zero human involvement in the agent's decision chain.

9. **Security**: Use CDP managed keys (never raw private keys in env). Add `pause()` to registry callable only by deployer. Implement a max-payout-per-task circuit breaker.

10. **Dashboard performance**: Use multicall3 to batch all onchain reads. Cache with 30s TTL. Expose a WebSocket endpoint for real-time agent action streaming to the frontend.
