import { createPublicClient, http } from "viem";
import { config } from "./config.js";

export const publicClient = createPublicClient({
  chain: config.chain,
  transport: http(config.rpcUrl),
});
