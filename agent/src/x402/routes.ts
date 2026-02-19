import { type Express } from "express";
import OpenAI from "openai";
import { parseEther, isAddress } from "viem";
import { costTracker } from "../cost-tracker.js";
import { type JobOrchestrator } from "../orchestrator.js";
import { config, NETWORK } from "../config.js";
import { type AgentWallet } from "../wallet.js";
import { clarifyJob } from "../clarifier.js";

const openai = new OpenAI();

let walletRef: AgentWallet | null = null;
export function setRouteWallet(w: AgentWallet) { walletRef = w; }

export function registerRoutes(app: Express, orchestrator: JobOrchestrator) {
  if (NETWORK === "localhost") {
    app.post("/api/faucet", async (req, res) => {
      try {
        const { address } = req.body;
        if (!address || !isAddress(address)) {
          res.status(400).json({ error: "Invalid address" });
          return;
        }
        if (!walletRef) {
          res.status(503).json({ error: "Agent wallet not ready" });
          return;
        }
        const hash = await walletRef.sendTransaction({
          to: address as `0x${string}`,
          value: parseEther("10"),
          data: "0x",
        });
        res.json({ hash, amount: "10 ETH" });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  app.post("/api/clarify", async (req, res) => {
    try {
      const { description, budget, conversation } = req.body;
      if (!description || !budget) {
        res.status(400).json({ error: "description and budget are required" });
        return;
      }
      const result = await clarifyJob(description, budget, conversation || []);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/metrics", (_req, res) => {
    res.json(costTracker.getMetricsSnapshot());
  });

  app.get("/api/actions", (_req, res) => {
    res.json(orchestrator.getRecentActions());
  });

  app.get("/api/transactions", (_req, res) => {
    res.json(orchestrator.getRecentTransactions());
  });

  app.get("/api/reimbursements", (_req, res) => {
    res.json(costTracker.getReimbursements());
  });

  app.post("/api/ai/analyze-image", async (req, res) => {
    try {
      const { imageUrl, prompt } = req.body;
      const result = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: [
          { type: "text", text: prompt || "Analyze this image in detail." },
          { type: "image_url", image_url: { url: imageUrl } },
        ]}],
      });
      costTracker.logRevenue({ type: "ai_service", amount_usd: 0.05 });
      costTracker.logCost({ type: "openai", amount_usd: 0.01, details: "ai-service-analyze" });
      orchestrator.emit("action", {
        type: "ai_service_sold", service: "analyze-image", revenue: 0.05, timestamp: Date.now(),
      });
      orchestrator.emitMetrics();
      res.json({ analysis: result.choices[0].message.content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/classify-text", async (req, res) => {
    try {
      const { text, categories } = req.body;
      const result = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: `Classify this text into one of these categories: ${categories?.join(", ") || "positive, negative, neutral"}.\n\nText: "${text}"` }],
        response_format: { type: "json_object" },
      });
      costTracker.logRevenue({ type: "ai_service", amount_usd: 0.03 });
      costTracker.logCost({ type: "openai", amount_usd: 0.005, details: "ai-service-classify" });
      orchestrator.emit("action", {
        type: "ai_service_sold", service: "classify-text", revenue: 0.03, timestamp: Date.now(),
      });
      orchestrator.emitMetrics();
      res.json(JSON.parse(result.choices[0].message.content!));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/verify-photo", async (req, res) => {
    try {
      const { imageUrl, requirements } = req.body;
      const result = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: [
          { type: "text", text: `Verify this photo meets the following requirements: ${requirements}. Respond as JSON with { "meets_requirements": true/false, "reasoning": "...", "score": 0.0-1.0 }` },
          { type: "image_url", image_url: { url: imageUrl } },
        ]}],
        response_format: { type: "json_object" },
      });
      costTracker.logRevenue({ type: "ai_service", amount_usd: 0.04 });
      costTracker.logCost({ type: "openai", amount_usd: 0.01, details: "ai-service-verify" });
      orchestrator.emit("action", {
        type: "ai_service_sold", service: "verify-photo", revenue: 0.04, timestamp: Date.now(),
      });
      orchestrator.emitMetrics();
      res.json(JSON.parse(result.choices[0].message.content!));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
