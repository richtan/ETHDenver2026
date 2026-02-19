#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ANVIL_PID=""
EXIT_CODE=0

cleanup() {
  [ -n "$ANVIL_PID" ] && kill "$ANVIL_PID" 2>/dev/null || true
  rm -f "$ROOT/agent/cost-tracker.json"
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Prerequisites ──────────────────────────────────────────────
if ! command -v anvil &>/dev/null; then
  echo "ERROR: Foundry not installed."
  exit 1
fi

# ── Kill stale processes on port 8545 ──────────────────────────
EXISTING=$(lsof -ti :8545 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "Killing stale process on port 8545..."
  kill $EXISTING 2>/dev/null || true
  sleep 1
fi

# ── Clean up cost tracker from previous runs ───────────────────
rm -f "$ROOT/agent/cost-tracker.json"

# ── Start Anvil ────────────────────────────────────────────────
echo "Starting Anvil..."
anvil --chain-id 31337 --silent &
ANVIL_PID=$!
sleep 2

if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
  echo "ERROR: Anvil failed to start."
  exit 1
fi
echo "Anvil running (pid $ANVIL_PID)"

# ── Deploy contract ────────────────────────────────────────────
AGENT_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
DEPLOYER_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

echo "Deploying contract..."
DEPLOY_OUTPUT=$(cd "$ROOT/contracts" && \
  AGENT_ADDRESS="$AGENT_ADDR" PRIVATE_KEY="$DEPLOYER_KEY" \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast 2>&1)

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "JobMarketplace deployed to:" | awk '{print $NF}')

if [ -z "$CONTRACT_ADDRESS" ]; then
  echo "ERROR: Deployment failed."
  echo "$DEPLOY_OUTPUT"
  exit 1
fi
echo "Contract: $CONTRACT_ADDRESS"

# ── Run E2E tests ──────────────────────────────────────────────
echo "Running E2E tests..."
cd "$ROOT/agent"

export NETWORK=localhost
export CONTRACT_ADDRESS="$CONTRACT_ADDRESS"
export DEPLOYMENT_BLOCK=0
export AGENT_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export MOCK_OPENAI=true
export OPENAI_API_KEY=mock

npx vitest run --reporter=verbose || EXIT_CODE=$?

if [ "$EXIT_CODE" -eq 0 ]; then
  echo ""
  echo "E2E tests passed."
else
  echo ""
  echo "E2E tests failed (exit code $EXIT_CODE)."
fi

exit $EXIT_CODE
