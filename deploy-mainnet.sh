#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_MAINNET="$ROOT/.env.mainnet"
AGENT_PID=""
FRONTEND_PID=""
RPC_URL="https://mainnet.base.org"
CHAIN_ID=8453

# Handle flags
DEPLOY=false
RESET=false
SKIP_START=false
for arg in "$@"; do
  case "$arg" in
    --deploy)     DEPLOY=true ;;
    --reset)      RESET=true ;;
    --skip-start) SKIP_START=true ;;
  esac
done

if [ "$RESET" = "true" ]; then
  echo "Re-prompting all secrets (press Enter to keep current values)..."
fi

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$AGENT_PID" ]    && kill "$AGENT_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# ── Helpers ────────────────────────────────────────────────────
load_env() {
  if [ -f "$ENV_MAINNET" ]; then
    set -a
    source "$ENV_MAINNET"
    set +a
  fi
}

save_env() {
  cat > "$ENV_MAINNET" <<EOF
AGENT_PRIVATE_KEY=$AGENT_PRIVATE_KEY
CONTRACT_ADDRESS=${CONTRACT_ADDRESS:-}
DEPLOYMENT_BLOCK=${DEPLOYMENT_BLOCK:-0}
OPENAI_API_KEY=$OPENAI_API_KEY
PINATA_JWT=${PINATA_JWT:-}
PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
BASE_RPC_URL=${BASE_RPC_URL:-$RPC_URL}
CDP_API_KEY_ID=${CDP_API_KEY_ID:-}
CDP_API_KEY_SECRET=${CDP_API_KEY_SECRET:-}
CDP_WALLET_SECRET=${CDP_WALLET_SECRET:-}
OPERATOR_WALLET_ADDRESS=${OPERATOR_WALLET_ADDRESS:-}
BUILDER_CODE=${BUILDER_CODE:-}
VITE_WALLETCONNECT_PROJECT_ID=${VITE_WALLETCONNECT_PROJECT_ID:-}
VITE_AGENT_API_URL=${VITE_AGENT_API_URL:-}
BASESCAN_API_KEY=${BASESCAN_API_KEY:-}
EOF
  chmod 600 "$ENV_MAINNET"
  echo "  Saved secrets to .env.mainnet"
}

prompt_secret() {
  local var_name="$1" prompt_msg="$2" required="$3" default_val="${4:-}"
  local current_val="${!var_name:-}"

  if [ -n "$current_val" ] && [ "$RESET" != "true" ]; then
    return
  fi

  local hint=""
  if [ -n "$current_val" ]; then
    hint=" (Enter to keep current)"
  fi

  if [ "$required" = "true" ]; then
    printf "  %s%s: " "$prompt_msg" "$hint"
    read -r input
    if [ -z "$input" ] && [ -n "$current_val" ]; then
      input="$current_val"
    fi
    while [ -z "$input" ]; do
      echo "  (required -- cannot be empty)"
      printf "  %s: " "$prompt_msg"
      read -r input
    done
    current_val="$input"
  else
    printf "  %s%s: " "$prompt_msg" "$hint"
    read -r input
    if [ -z "$input" ]; then
      input="${current_val:-$default_val}"
    fi
    current_val="$input"
  fi

  export "$var_name=$current_val"
}

# ── Prerequisites ──────────────────────────────────────────────
echo ""
echo "============================================"
echo "  MAINNET DEPLOYMENT (Base L2 — chain 8453)"
echo "============================================"
echo ""
echo "  WARNING: This script operates on BASE MAINNET."
echo "  All transactions use REAL ETH. Double-check every value."
echo ""
echo "Checking prerequisites..."

if ! command -v forge &>/dev/null; then
  echo "ERROR: Foundry not installed. Run: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not installed."
  exit 1
fi

if ! command -v cast &>/dev/null; then
  echo "ERROR: cast (Foundry) not found."
  exit 1
fi

# ── Secrets setup ──────────────────────────────────────────────
load_env

echo ""
echo "Configuring Base mainnet environment..."

# --- Core secrets ---
prompt_secret "AGENT_PRIVATE_KEY"   "Agent wallet private key (needs Base mainnet ETH)"    "true"
prompt_secret "OPENAI_API_KEY"      "OpenAI API key"                                       "true"

# --- RPC ---
echo ""
echo "  Default RPC: $RPC_URL"
echo "  Provide a custom Alchemy/Infura URL for better reliability, or press Enter for default."
prompt_secret "BASE_RPC_URL"        "Base mainnet RPC URL"  "false"  "$RPC_URL"
RPC_URL="${BASE_RPC_URL:-$RPC_URL}"

# --- CDP credentials (mainnet-only) ---
echo ""
echo "  Coinbase Developer Platform credentials (required for mainnet agent)."
echo "  Get them at: https://portal.cdp.coinbase.com"
prompt_secret "CDP_API_KEY_ID"      "CDP API Key ID"       "true"
prompt_secret "CDP_API_KEY_SECRET"  "CDP API Key Secret"   "true"
prompt_secret "CDP_WALLET_SECRET"   "CDP Wallet Secret"    "true"

# --- Operator & builder code ---
echo ""
prompt_secret "OPERATOR_WALLET_ADDRESS" "Operator wallet address (for profit withdrawal)" "true"
prompt_secret "BUILDER_CODE"            "ERC-8021 builder code (hex, no 0x prefix)"       "true"

# --- IPFS ---
echo ""
[ -z "${PINATA_JWT:-}" ] && echo "  Get Pinata JWT at: https://app.pinata.cloud -> API Keys"
prompt_secret "PINATA_JWT"          "Pinata JWT for IPFS uploads (Enter to skip)"           "false"
prompt_secret "PINATA_GATEWAY"      "Pinata gateway URL (Enter for default)"                "false" "https://gateway.pinata.cloud"

# --- Supabase ---
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo ""
  echo "  Get Supabase credentials at: https://supabase.com -> Settings > API"
fi
prompt_secret "SUPABASE_URL"        "Supabase project URL"    "true"
prompt_secret "SUPABASE_ANON_KEY"   "Supabase anon key"       "true"

# --- Frontend-specific ---
echo ""
echo "  Frontend configuration (for production build)."
prompt_secret "VITE_WALLETCONNECT_PROJECT_ID" "WalletConnect project ID (https://cloud.walletconnect.com)" "true"
prompt_secret "VITE_AGENT_API_URL"            "Public agent API URL (e.g. https://agent.yourdomain.com)"   "true"

# --- BaseScan (for contract verification) ---
echo ""
[ -z "${BASESCAN_API_KEY:-}" ] && echo "  Get a BaseScan API key at: https://basescan.org/myapikey"
prompt_secret "BASESCAN_API_KEY"    "BaseScan API key (for contract verification, Enter to skip)" "false"

# Add 0x prefix if missing
[[ "$AGENT_PRIVATE_KEY" != 0x* ]] && AGENT_PRIVATE_KEY="0x$AGENT_PRIVATE_KEY"

# Derive agent address
AGENT_ADDR=$(cast wallet address "$AGENT_PRIVATE_KEY" 2>&1) || {
  echo "ERROR: Invalid private key."
  echo "$AGENT_ADDR"
  exit 1
}
echo ""
echo "  Agent address: $AGENT_ADDR"

# Check agent balance
BALANCE_WEI=$(cast balance "$AGENT_ADDR" --rpc-url "$RPC_URL" 2>/dev/null) || BALANCE_WEI="0"
BALANCE_ETH=$(cast from-wei "$BALANCE_WEI" 2>/dev/null) || BALANCE_ETH="unknown"
echo "  Agent balance: $BALANCE_ETH ETH"

if [ "$BALANCE_WEI" = "0" ]; then
  echo ""
  echo "  WARNING: Agent wallet has 0 ETH on Base mainnet."
  echo "  Fund $AGENT_ADDR before proceeding."
  printf "  Continue anyway? (y/N): "
  read -r confirm
  [[ "$confirm" != [yY]* ]] && exit 1
fi

# ── Install dependencies ──────────────────────────────────────
echo ""
echo "Installing dependencies..."
(cd "$ROOT/agent"    && [ -d node_modules ] || npm install --silent)
(cd "$ROOT/frontend" && [ -d node_modules ] || npm install --silent)

# ── Deploy contract ────────────────────────────────────────────
if [ "$DEPLOY" = "true" ] || [ -z "${CONTRACT_ADDRESS:-}" ]; then
  echo ""
  if [ -z "${CONTRACT_ADDRESS:-}" ]; then
    echo "No contract address saved. Deploying to Base mainnet..."
  else
    echo "Deploying new contract to Base mainnet..."
  fi

  echo ""
  echo "  IMPORTANT: The deployer wallet needs Base mainnet ETH for gas."
  echo "  Can be the same wallet as the agent, or a different one."
  prompt_secret "DEPLOYER_PRIVATE_KEY" "Deployer wallet private key" "true"
  [[ "$DEPLOYER_PRIVATE_KEY" != 0x* ]] && DEPLOYER_PRIVATE_KEY="0x$DEPLOYER_PRIVATE_KEY"

  DEPLOYER_ADDR=$(cast wallet address "$DEPLOYER_PRIVATE_KEY" 2>&1)
  DEPLOYER_BAL_WEI=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$RPC_URL" 2>/dev/null) || DEPLOYER_BAL_WEI="0"
  DEPLOYER_BAL_ETH=$(cast from-wei "$DEPLOYER_BAL_WEI" 2>/dev/null) || DEPLOYER_BAL_ETH="unknown"
  echo "  Deployer address: $DEPLOYER_ADDR"
  echo "  Deployer balance: $DEPLOYER_BAL_ETH ETH"

  if [ "$DEPLOYER_BAL_WEI" = "0" ]; then
    echo "  ERROR: Deployer wallet has 0 ETH. Fund it and try again."
    exit 1
  fi

  echo ""
  echo "  About to deploy JobMarketplace to Base mainnet."
  echo "  Agent address: $AGENT_ADDR"
  printf "  Confirm deployment? (y/N): "
  read -r confirm
  [[ "$confirm" != [yY]* ]] && { echo "Deployment cancelled."; exit 1; }

  echo "  Deploying contract (this may take a minute)..."

  VERIFY_FLAGS=""
  if [ -n "${BASESCAN_API_KEY:-}" ]; then
    VERIFY_FLAGS="--verify --etherscan-api-key $BASESCAN_API_KEY"
  fi

  set +e
  DEPLOY_OUTPUT=$(cd "$ROOT/contracts" && \
    AGENT_ADDRESS="$AGENT_ADDR" PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" BASE_RPC_URL="$RPC_URL" \
    forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --slow $VERIFY_FLAGS 2>&1)
  CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "JobMarketplace deployed to:" | awk '{print $NF}')
  set -e

  if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "ERROR: Deployment failed."
    echo "$DEPLOY_OUTPUT"
    exit 1
  fi

  DEPLOYMENT_BLOCK=$(python3 -c "
import json, glob
files = glob.glob('$ROOT/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json')
if files:
    data = json.load(open(files[0]))
    print(int(data['receipts'][0]['blockNumber'], 16))
else:
    print(0)
") || DEPLOYMENT_BLOCK=0

  echo ""
  echo "  Contract deployed at $CONTRACT_ADDRESS (block $DEPLOYMENT_BLOCK)"
  echo "  BaseScan: https://basescan.org/address/$CONTRACT_ADDRESS"
  echo "  Waiting for indexing..."
  sleep 10
else
  echo ""
  echo "  Using saved contract: $CONTRACT_ADDRESS"
  if [ "${DEPLOYMENT_BLOCK:-0}" = "0" ] && [ -f "$ROOT/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json" ]; then
    DEPLOYMENT_BLOCK=$(python3 -c "
import json
data = json.load(open('$ROOT/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json'))
print(int(data['receipts'][0]['blockNumber'], 16))
") || true
  fi
fi

# Save all secrets
save_env

# ── Write .env files ─────────────────────────────────────────
cat > "$ROOT/agent/.env" <<EOF
NETWORK=base
BASE_RPC_URL=$RPC_URL
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
DEPLOYMENT_BLOCK=${DEPLOYMENT_BLOCK:-0}
AGENT_PRIVATE_KEY=$AGENT_PRIVATE_KEY
CDP_API_KEY_ID=${CDP_API_KEY_ID:-}
CDP_API_KEY_SECRET=${CDP_API_KEY_SECRET:-}
CDP_WALLET_SECRET=${CDP_WALLET_SECRET:-}
OPENAI_API_KEY=$OPENAI_API_KEY
PINATA_JWT=${PINATA_JWT:-}
PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
OPERATOR_WALLET_ADDRESS=${OPERATOR_WALLET_ADDRESS:-}
BUILDER_CODE=${BUILDER_CODE:-}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
PORT=3001
EOF

cat > "$ROOT/frontend/.env" <<EOF
VITE_CHAIN=base
VITE_CONTRACT_ADDRESS=$CONTRACT_ADDRESS
VITE_AGENT_API_URL=${VITE_AGENT_API_URL:-http://localhost:3001}
VITE_WALLETCONNECT_PROJECT_ID=${VITE_WALLETCONNECT_PROJECT_ID:-}
VITE_PINATA_JWT=${PINATA_JWT:-}
VITE_PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
VITE_SUPABASE_URL=${SUPABASE_URL:-}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
EOF

echo ""
echo "Environment files written to agent/.env and frontend/.env"

# ── Optionally start services locally ─────────────────────────
if [ "$SKIP_START" = "true" ]; then
  echo ""
  echo "============================================"
  echo "  Mainnet config complete (--skip-start)"
  echo "============================================"
  echo ""
  echo "  .env files are ready. Deploy the services yourself:"
  echo "    Agent:    cd agent && npm run build && npm start"
  echo "    Frontend: cd frontend && npm run build"
  echo ""
  echo "  Contract:  $CONTRACT_ADDRESS"
  echo "  Agent:     $AGENT_ADDR"
  echo "  BaseScan:  https://basescan.org/address/$CONTRACT_ADDRESS"
  echo ""
  exit 0
fi

# ── Start agent ───────────────────────────────────────────────
echo ""
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
echo "  TaskMaster (Base Mainnet) is running!"
echo "============================================"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Agent API: http://localhost:3001"
echo "  Chain:     Base Mainnet ($CHAIN_ID)"
echo "  RPC:       $RPC_URL"
echo "  Contract:  $CONTRACT_ADDRESS"
echo "  Agent:     $AGENT_ADDR"
echo "  Balance:   $BALANCE_ETH ETH"
echo ""
echo "  BaseScan:  https://basescan.org/address/$CONTRACT_ADDRESS"
echo ""
if [ -z "${PINATA_JWT:-}" ]; then
  echo "  WARNING: No Pinata JWT configured. IPFS proof uploads will fail."
  echo "  Run with --reset to reconfigure."
  echo ""
fi
echo "  Usage:"
echo "    ./deploy-mainnet.sh                Deploy/run with saved config"
echo "    ./deploy-mainnet.sh --deploy       Deploy a new contract"
echo "    ./deploy-mainnet.sh --reset        Re-prompt all secrets"
echo "    ./deploy-mainnet.sh --skip-start   Configure .env files only (no local servers)"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

wait
