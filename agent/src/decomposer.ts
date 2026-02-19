import OpenAI from "openai";
import { formatEther } from "viem";
import { type TaskPlan } from "./types.js";

const openai = new OpenAI();

const DECOMPOSE_PROMPT = `You are TaskMaster, an AI agent that breaks complex real-world jobs into
sequential subtasks that humans can complete.

Given a job description and total budget, output a JSON array of tasks in execution order.
Each task should have:
- description: What the human needs to do
- proofRequirements: How the human proves they did it
- reward: ETH amount (as string like "0.003")
- deadlineMinutes: Time allowed
- dependsOnPrevious: true if this task needs the previous one's deliverable

Rules:
- Total rewards must be LESS than the budget (the difference is your profit)
- Keep at least 20-30% margin for profit
- Tasks should be specific, actionable, and verifiable
- Each task should produce a concrete deliverable
- Proof must always be a SINGLE IMAGE (PNG/JPG) -- workers upload one photo or screenshot
- For design tasks: worker uploads a screenshot/photo of the design (not the PDF itself)
- For physical tasks requiring multiple photos (e.g. "post flyers in 10 locations"):
  worker creates a photo collage/grid of all locations and uploads as one image
- Each task has exactly ONE proof image

Return JSON object with shape: { "tasks": [...], "totalWorkerCost": "0.007", "agentProfit": "0.003" }`;

export async function decomposeJob(description: string, budget: bigint): Promise<TaskPlan[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: DECOMPOSE_PROMPT },
      { role: "user", content: `Job: "${description}"\nBudget: ${formatEther(budget)} ETH` },
    ],
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(response.choices[0].message.content!);
  return parsed.tasks as TaskPlan[];
}
