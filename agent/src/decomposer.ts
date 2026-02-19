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

Precision rules (STRICT):
- Task descriptions must be specific and measurable. BAD: "Design a flyer".
  GOOD: "Design an A4 portrait flyer (2480x3508px) with the headline 'Summer Sale 2025',
  the company logo in the top-left corner, and at least 3 product images."
- proofRequirements must list exact, checkable acceptance criteria that a reviewer can
  verify against the submitted image. BAD: "Screenshot of the design".
  GOOD: "Screenshot of final design showing: (1) A4 dimensions, (2) headline text visible,
  (3) logo placed in top-left, (4) at least 3 product images included."
- NEVER use vague words like "appropriate", "suitable", "nice", "good quality",
  "professional-looking", or "as needed" in descriptions or requirements.
  Replace with specific, checkable criteria.
- Every requirement must be binary-verifiable: a reviewer can answer yes/no for each one.

Return JSON object with shape: { "tasks": [...], "totalWorkerCost": "0.007", "agentProfit": "0.003" }`;

export async function decomposeJob(description: string, budget: bigint): Promise<TaskPlan[]> {
  if (process.env.MOCK_OPENAI === "true") {
    const rewardEach = formatEther(budget * 35n / 100n);
    return [
      {
        description: "Design a promotional flyer with product name, tagline, and key features",
        proofRequirements: "Screenshot of final design as PNG/JPG",
        reward: rewardEach,
        deadlineMinutes: 120,
        dependsOnPrevious: false,
      },
      {
        description: "Print and distribute flyers at the specified locations",
        proofRequirements: "Photo collage showing flyers posted at multiple locations",
        reward: rewardEach,
        deadlineMinutes: 180,
        dependsOnPrevious: true,
      },
    ];
  }

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
