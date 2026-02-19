import "dotenv/config";
import { config, NETWORK } from "./config.js";
import { publicClient } from "./client.js";
import { createAgentWallet } from "./wallet.js";
import { setAgentWallet } from "./actions/marketplace.js";
import { JobOrchestrator } from "./orchestrator.js";
import { recoverState } from "./recovery.js";
import { startScheduler } from "./scheduler.js";
import { startServer } from "./x402/server.js";
import { JOB_MARKETPLACE_ABI } from "./abi.js";
import { formatEther } from "viem";

async function main() {
  console.log(`Starting TaskMaster agent on ${NETWORK}...`);

  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS env var is required");
  }

  const wallet = await createAgentWallet();
  console.log(`Agent wallet: ${wallet.address}`);

  const contractAgent = await publicClient.readContract({
    address: config.contractAddress,
    abi: JOB_MARKETPLACE_ABI,
    functionName: "agent",
  });
  if ((contractAgent as string).toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `Wallet ${wallet.address} does not match contract agent ${contractAgent}. ` +
      `Check AGENT_ADDRESS used during deployment.`
    );
  }

  const balance = await publicClient.getBalance({ address: wallet.address });
  console.log(`Agent balance: ${formatEther(balance)} ETH`);
  if (balance < 100000000000000n) {
    console.warn("WARNING: Agent balance is very low. Transactions may fail.");
  }

  if (NETWORK !== "localhost" && config.deploymentBlock === 0n) {
    console.warn("WARNING: DEPLOYMENT_BLOCK is 0 on non-localhost. State recovery will scan from genesis.");
  }

  setAgentWallet(wallet);

  const orchestrator = new JobOrchestrator();

  await recoverState(orchestrator);

  orchestrator.startListening();

  await startServer(orchestrator, wallet.address);

  startScheduler(wallet, orchestrator);

  console.log("TaskMaster agent fully operational.");
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
