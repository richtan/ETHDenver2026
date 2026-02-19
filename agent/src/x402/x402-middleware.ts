import { config } from "../config.js";
import { type Express } from "express";

export async function applyX402(app: Express, agentAddress: string) {
  if (!config.x402Enabled) {
    return;
  }

  const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
  const { ExactEvmScheme } = await import("@x402/evm/exact/server");
  const { HTTPFacilitatorClient } = await import("@x402/core/server");

  const facilitator = new HTTPFacilitatorClient({ url: "https://facilitator.x402.org" });

  const server = new x402ResourceServer(facilitator)
    .register("eip155:8453", new ExactEvmScheme());

  const routes = {
    "POST /api/ai/analyze-image": {
      accepts: { scheme: "exact", payTo: agentAddress, price: "$0.05", network: "eip155:8453" as const },
      description: "AI image analysis",
    },
    "POST /api/ai/classify-text": {
      accepts: { scheme: "exact", payTo: agentAddress, price: "$0.03", network: "eip155:8453" as const },
      description: "AI text classification",
    },
    "POST /api/ai/verify-photo": {
      accepts: { scheme: "exact", payTo: agentAddress, price: "$0.04", network: "eip155:8453" as const },
      description: "AI photo verification",
    },
  };

  app.use(paymentMiddleware(routes, server));
}
