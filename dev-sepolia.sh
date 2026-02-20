#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_SEPOLIA="$ROOT/.env.sepolia"
AGENT_PID=""
FRONTEND_PID=""
RPC_URL="https://sepolia.base.org"

# Handle flags
DEPLOY=false
RESET=false
for arg in "$@"; do
  case "$arg" in
    --deploy) DEPLOY=true ;;
    --reset)  RESET=true ;;
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
  if [ -f "$ENV_SEPOLIA" ]; then
    set -a
    source "$ENV_SEPOLIA"
    set +a
  fi
}

save_env() {
  cat > "$ENV_SEPOLIA" <<EOF
AGENT_PRIVATE_KEY=$AGENT_PRIVATE_KEY
CONTRACT_ADDRESS=${CONTRACT_ADDRESS:-}
DEPLOYMENT_BLOCK=${DEPLOYMENT_BLOCK:-0}
OPENAI_API_KEY=$OPENAI_API_KEY
PINATA_JWT=${PINATA_JWT:-}
PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
EOF
  echo "  Saved secrets to .env.sepolia"
}

prompt_secret() {
  local var_name="$1" prompt_msg="$2" required="$3" default_val="${4:-}"
  local current_val="${!var_name:-}"

  # Skip if value exists and not resetting
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
echo "Checking prerequisites..."

if ! command -v forge &>/dev/null; then
  echo "ERROR: Foundry not installed. Run: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not installed."
  exit 1
fi

# ── Secrets setup ──────────────────────────────────────────────
load_env

echo ""
echo "Configuring Base Sepolia environment..."
if [ -z "${AGENT_PRIVATE_KEY:-}" ]; then
  echo "  Get Base Sepolia ETH at: https://portal.cdp.coinbase.com/products/faucet"
  echo "  Export private key from MetaMask: Account Details > Show Private Key"
fi
prompt_secret "AGENT_PRIVATE_KEY"   "Agent wallet private key (needs Base Sepolia ETH)"    "true"
[ -z "${OPENAI_API_KEY:-}" ] && echo "  Get OpenAI key at: https://platform.openai.com/api-keys"
prompt_secret "OPENAI_API_KEY"      "OpenAI API key"                                       "true"
[ -z "${PINATA_JWT:-}" ] && echo "  Get Pinata JWT at: https://app.pinata.cloud -> API Keys"
prompt_secret "PINATA_JWT"          "Pinata JWT for IPFS uploads (Enter to skip)"           "false"
prompt_secret "PINATA_GATEWAY"      "Pinata gateway URL (Enter for default)"                "false" "https://gateway.pinata.cloud"
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "  Get Supabase credentials at: https://supabase.com -> Settings > API"
fi
prompt_secret "SUPABASE_URL"        "Supabase project URL"                                  "true"
prompt_secret "SUPABASE_ANON_KEY"   "Supabase anon key"                                     "true"

# Add 0x prefix if missing (MetaMask exports without it)
[[ "$AGENT_PRIVATE_KEY" != 0x* ]] && AGENT_PRIVATE_KEY="0x$AGENT_PRIVATE_KEY"

# Derive agent address from private key
AGENT_ADDR=$(cast wallet address "$AGENT_PRIVATE_KEY" 2>&1) || {
  echo "ERROR: Invalid private key."
  echo "$AGENT_ADDR"
  exit 1
}
echo "  Agent address: $AGENT_ADDR"

# ── Install dependencies ──────────────────────────────────────
echo "Installing dependencies..."
(cd "$ROOT/agent"    && [ -d node_modules ] || npm install --silent)
(cd "$ROOT/frontend" && [ -d node_modules ] || npm install --silent)

# ── Deploy contract (if --deploy flag or no saved address) ────
if [ "$DEPLOY" = "true" ] || [ -z "${CONTRACT_ADDRESS:-}" ]; then
  echo ""
  if [ -z "${CONTRACT_ADDRESS:-}" ]; then
    echo "No contract address saved. Deploying to Base Sepolia..."
  else
    echo "Deploying new contract to Base Sepolia..."
  fi

  echo "  Can be the same wallet as the agent, or a different one"
  prompt_secret "DEPLOYER_PRIVATE_KEY" "Deployer wallet private key (needs Base Sepolia ETH)" "true"
  [[ "$DEPLOYER_PRIVATE_KEY" != 0x* ]] && DEPLOYER_PRIVATE_KEY="0x$DEPLOYER_PRIVATE_KEY"

  echo "  Deploying contract (this may take a minute)..."
  set +e
  DEPLOY_OUTPUT=$(cd "$ROOT/contracts" && \
    AGENT_ADDRESS="$AGENT_ADDR" PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" \
    forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast 2>&1)
  CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "JobMarketplace deployed to:" | awk '{print $NF}')
  set -e

  if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "ERROR: Deployment failed."
    echo "$DEPLOY_OUTPUT"
    exit 1
  fi
  # Extract deployment block from broadcast JSON
  DEPLOYMENT_BLOCK=$(python3 -c "
import json
data = json.load(open('$ROOT/contracts/broadcast/Deploy.s.sol/84532/run-latest.json'))
print(int(data['receipts'][0]['blockNumber'], 16))
")

  echo "Contract deployed at $CONTRACT_ADDRESS (block $DEPLOYMENT_BLOCK)"
  echo "  View on BaseScan: https://sepolia.basescan.org/address/$CONTRACT_ADDRESS"
  echo "  Waiting for contract to be indexed..."
  sleep 10
else
  echo "  Using saved contract: $CONTRACT_ADDRESS"
  # Try to recover deployment block from broadcast JSON if missing
  if [ "${DEPLOYMENT_BLOCK:-0}" = "0" ] && [ -f "$ROOT/contracts/broadcast/Deploy.s.sol/84532/run-latest.json" ]; then
    DEPLOYMENT_BLOCK=$(python3 -c "
import json
data = json.load(open('$ROOT/contracts/broadcast/Deploy.s.sol/84532/run-latest.json'))
print(int(data['receipts'][0]['blockNumber'], 16))
") || true
  fi
fi

# Save all secrets (including contract address)
save_env

# ── Write .env files ─────────────────────────────────────────
cat > "$ROOT/agent/.env" <<EOF
NETWORK=base-sepolia
BASE_SEPOLIA_RPC_URL=$RPC_URL
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
DEPLOYMENT_BLOCK=${DEPLOYMENT_BLOCK:-0}
AGENT_PRIVATE_KEY=$AGENT_PRIVATE_KEY
OPENAI_API_KEY=$OPENAI_API_KEY
PINATA_JWT=${PINATA_JWT:-}
PINATA_GATEWAY=${PINATA_GATEWAY:-https://gateway.pinata.cloud}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
PORT=3001
EOF

cat > "$ROOT/frontend/.env" <<EOF
VITE_CHAIN=base-sepolia
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
echo "  TaskMaster (Base Sepolia) is running!"
echo "============================================"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Agent API: http://localhost:3001"
echo "  Chain:     Base Sepolia (84532)"
echo "  RPC:       $RPC_URL"
echo "  Contract:  $CONTRACT_ADDRESS"
echo "  Agent:     $AGENT_ADDR"
echo ""
echo "  BaseScan:  https://sepolia.basescan.org/address/$CONTRACT_ADDRESS"
echo ""
if [ -z "${PINATA_JWT:-}" ]; then
  echo "  WARNING: No Pinata JWT configured. IPFS proof uploads will fail."
  echo "  Run with --reset to reconfigure."
  echo ""
fi
echo "  Usage:"
echo "    ./dev-sepolia.sh            Start with saved config"
echo "    ./dev-sepolia.sh --deploy   Deploy a new contract"
echo "    ./dev-sepolia.sh --reset    Re-prompt all secrets"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

wait
