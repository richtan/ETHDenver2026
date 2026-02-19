#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ANVIL_PID=""
AGENT_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$AGENT_PID" ]    && kill "$AGENT_PID" 2>/dev/null
  [ -n "$ANVIL_PID" ]    && kill "$ANVIL_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# ── Prerequisites ──────────────────────────────────────────────
echo "Checking prerequisites..."

if ! command -v anvil &>/dev/null; then
  echo "ERROR: Foundry not installed. Run: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not installed."
  exit 1
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERROR: OPENAI_API_KEY not set. Export it first:"
  echo "  export OPENAI_API_KEY=sk-..."
  exit 1
fi

# ── Install dependencies ──────────────────────────────────────
echo "Installing dependencies..."
(cd "$ROOT/agent"    && [ -d node_modules ] || npm install --silent)
(cd "$ROOT/frontend" && [ -d node_modules ] || npm install --silent)

# ── Anvil ─────────────────────────────────────────────────────
echo "Starting Anvil..."
EXISTING_PID=$(lsof -ti :8545 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
  echo "Port 8545 in use (pid $EXISTING_PID), killing..."
  kill $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

anvil --chain-id 31337 --silent &
ANVIL_PID=$!
sleep 2

if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
  echo "ERROR: Anvil failed to start."
  exit 1
fi
echo "Anvil running (pid $ANVIL_PID)"

# Anvil deterministic addresses:
#   Account 0 = Agent   (0xf39F...2266)
#   Account 1 = Deployer (0x7099...79C8)
#   Account 2+ = Test users
AGENT_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
DEPLOYER_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

# ── Deploy contract ───────────────────────────────────────────
echo "Deploying JobMarketplace..."
DEPLOY_OUTPUT=$(cd "$ROOT/contracts" && \
  AGENT_ADDRESS="$AGENT_ADDR" PRIVATE_KEY="$DEPLOYER_KEY" \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast 2>&1)

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "JobMarketplace deployed to:" | awk '{print $NF}')

if [ -z "$CONTRACT_ADDRESS" ]; then
  echo "ERROR: Deployment failed."
  echo "$DEPLOY_OUTPUT"
  exit 1
fi
echo "Contract deployed at $CONTRACT_ADDRESS"

# ── Write .env files ─────────────────────────────────────────
cat > "$ROOT/agent/.env" <<EOF
NETWORK=localhost
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
DEPLOYMENT_BLOCK=0
AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OPENAI_API_KEY=$OPENAI_API_KEY
PORT=3001
EOF

cat > "$ROOT/frontend/.env" <<EOF
VITE_CHAIN=localhost
VITE_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
VITE_AGENT_API_URL=http://localhost:3001
VITE_WALLETCONNECT_PROJECT_ID=placeholder-for-dev
VITE_PINATA_JWT=
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud
EOF

echo "Environment files written."

# ── Start agent ───────────────────────────────────────────────
echo "Starting agent..."
(cd "$ROOT/agent" && npm run dev 2>&1 | sed 's/^/[agent] /') &
AGENT_PID=$!
sleep 3

# ── Start frontend ────────────────────────────────────────────
echo "Starting frontend..."
(cd "$ROOT/frontend" && npm run dev 2>&1 | sed 's/^/[frontend] /') &
FRONTEND_PID=$!
sleep 2

# ── Ready ─────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  TaskMaster dev environment is running!"
echo "============================================"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Agent API: http://localhost:3001"
echo "  Anvil RPC: http://127.0.0.1:8545"
echo "  Contract:  $CONTRACT_ADDRESS"
echo ""
echo "  Test wallets (import into MetaMask):"
echo "    Client:  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
echo "    Worker:  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

wait
