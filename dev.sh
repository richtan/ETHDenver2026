#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_LOCAL="$ROOT/.env.local"
ANVIL_PID=""
AGENT_PID=""
FRONTEND_PID=""

# Handle --reset flag to force re-prompting of secrets
if [ "${1:-}" = "--reset" ]; then
  echo "Resetting saved secrets..."
  rm -f "$ENV_LOCAL"
fi

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

# ── Helpers ────────────────────────────────────────────────────
load_env_local() {
  if [ -f "$ENV_LOCAL" ]; then
    set -a
    source "$ENV_LOCAL"
    set +a
  fi
}

save_env_local() {
  cat > "$ENV_LOCAL" <<EOF
OPENAI_API_KEY=$OPENAI_API_KEY
PINATA_JWT=${PINATA_JWT:-}
PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
EOF
  echo "  Saved secrets to .env.local"
}

prompt_secret() {
  local var_name="$1" prompt_msg="$2" required="$3" default_val="${4:-}"
  local current_val="${!var_name:-}"

  if [ -n "$current_val" ]; then
    return
  fi

  if [ "$required" = "true" ]; then
    while [ -z "$current_val" ]; do
      printf "  %s: " "$prompt_msg"
      read -r current_val
      if [ -z "$current_val" ]; then
        echo "  (required -- cannot be empty)"
      fi
    done
  else
    printf "  %s: " "$prompt_msg"
    read -r current_val
    if [ -z "$current_val" ] && [ -n "$default_val" ]; then
      current_val="$default_val"
    fi
  fi

  export "$var_name=$current_val"
}

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

# ── Secrets setup ──────────────────────────────────────────────
load_env_local

NEEDS_PROMPT=false
if [ -z "${OPENAI_API_KEY:-}" ] || [ -z "${PINATA_JWT:-}" ] || [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  NEEDS_PROMPT=true
fi

if [ "$NEEDS_PROMPT" = "true" ]; then
  echo ""
  echo "Configuring secrets (saved to .env.local for future runs)..."
  prompt_secret "OPENAI_API_KEY"  "Enter your OpenAI API key"                          "true"
  prompt_secret "PINATA_JWT"      "Enter Pinata JWT for IPFS uploads (Enter to skip)"  "false"
  prompt_secret "PINATA_GATEWAY"  "Pinata gateway URL (Enter for default)"             "false" "https://gateway.pinata.cloud"
  prompt_secret "SUPABASE_URL"    "Enter your Supabase project URL"                    "true"
  prompt_secret "SUPABASE_ANON_KEY" "Enter your Supabase anon key"                     "true"
  save_env_local
  echo ""
else
  echo "  Secrets loaded from .env.local"
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
#   Account 0 = Agent    (0xf39F...2266)
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
PINATA_JWT=${PINATA_JWT:-}
PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
PORT=3001
EOF

cat > "$ROOT/frontend/.env" <<EOF
VITE_CHAIN=localhost
VITE_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
VITE_AGENT_API_URL=http://localhost:3001
VITE_WALLETCONNECT_PROJECT_ID=placeholder-for-dev
VITE_PINATA_JWT=${PINATA_JWT:-}
VITE_PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
VITE_SUPABASE_URL=${SUPABASE_URL:-}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
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
if [ -z "${PINATA_JWT:-}" ]; then
  echo "  WARNING: No Pinata JWT configured. IPFS proof uploads will fail."
  echo "  Run this script again or edit .env.local to add PINATA_JWT."
  echo ""
fi
echo "  Press Ctrl+C to stop everything."
echo ""

wait
