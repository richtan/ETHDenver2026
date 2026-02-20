import express from "express";
import cors from "cors";
import { type JobOrchestrator } from "../orchestrator.js";
import { registerRoutes } from "./routes.js";
import { applyX402 } from "./x402-middleware.js";

export async function startServer(orchestrator: JobOrchestrator, agentAddress: string) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  await applyX402(app, agentAddress);

  registerRoutes(app, orchestrator);

  app.get("/api/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Flush immediately so the browser confirms the stream is live
    res.write(": connected\n\n");

    // Heartbeat every 30s to prevent TCP/proxy timeouts on idle connections
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 30_000);

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const onAction = (action: any) => send("action", action);
    const onMetrics = (metrics: any) => send("metrics", metrics);
    const onTx = (tx: any) => send("transaction", tx);
    orchestrator.on("action", onAction);
    orchestrator.on("metrics", onMetrics);
    orchestrator.on("transaction", onTx);

    req.on("close", () => {
      clearInterval(heartbeat);
      orchestrator.off("action", onAction);
      orchestrator.off("metrics", onMetrics);
      orchestrator.off("transaction", onTx);
    });
  });

  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Agent API on port ${port}`));
}
