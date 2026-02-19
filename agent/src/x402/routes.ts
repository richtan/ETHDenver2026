import { type Express } from "express";
import OpenAI from "openai";
import { costTracker } from "../cost-tracker.js";
import { type JobOrchestrator } from "../orchestrator.js";

const openai = new OpenAI();

export function registerRoutes(app: Express, orchestrator: JobOrchestrator) {
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
