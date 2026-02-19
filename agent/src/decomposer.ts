import OpenAI from "openai";
import { formatEther } from "viem";
import { type TaskPlan } from "./types.js";

const openai = new OpenAI();

const DECOMPOSE_PROMPT = `You are TaskMaster, an AI agent that breaks complex real-world jobs into
sequential subtasks. You can execute some tasks yourself (research, information gathering) and
delegate others to human workers.

Given a job description and total budget, output a JSON array of tasks in execution order.
Each task should have:
- description: What needs to be done
- proofRequirements: How the human proves they did it (use "N/A - AI executed" for AI tasks)
- reward: ETH amount (as string like "0.003") — use "0" for AI tasks
- deadlineMinutes: Time allowed
- dependsOnPrevious: true if this task needs the previous one's deliverable
- tags: 3-5 lowercase skill tags describing the type of work
- executorType: "ai" or "human"

Executor classification rules:
- "ai": Tasks that can be done entirely through research, information lookup, web searching,
  finding dates/times/prices, monitoring websites, comparing options, compiling information,
  writing text, data analysis, finding contact info, or any purely informational work.
- "human": Tasks that require physical presence, buying/purchasing items, going to locations,
  taking real-world photos, creating visual designs from scratch, printing, posting physical
  materials, physical delivery, or any action a software agent cannot perform.
- When in doubt, classify as "human".
- AI tasks should come BEFORE the human tasks they support (e.g., research first, then act).
- Minimize human tasks — only use humans where AI truly cannot do the work.

Rules:
- Total rewards for HUMAN tasks must be LESS than the budget (the difference is your profit)
- Keep at least 20-30% margin for profit (calculated on human tasks only)
- Tasks should be specific, actionable, and verifiable
- Each human task should produce a concrete deliverable
- Proof for human tasks must always be a SINGLE IMAGE (PNG/JPG) -- workers upload one photo or screenshot
- For design tasks: worker uploads a screenshot/photo of the design (not the PDF itself)
- For physical tasks requiring multiple photos (e.g. "post flyers in 10 locations"):
  worker creates a photo collage/grid of all locations and uploads as one image
- Each human task has exactly ONE proof image

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
        description: "Research the product specifications, availability, and pricing",
        proofRequirements: "N/A - AI executed",
        reward: "0",
        deadlineMinutes: 10,
        dependsOnPrevious: false,
        tags: ["research"],
        executorType: "ai" as const,
      },
      {
        description: "Design a promotional flyer with product name, tagline, and key features",
        proofRequirements: "Screenshot of final design as PNG/JPG",
        reward: rewardEach,
        deadlineMinutes: 120,
        dependsOnPrevious: true,
        tags: ["design", "marketing", "graphic-design"],
        executorType: "human" as const,
      },
      {
        description: "Print and distribute flyers at the specified locations",
        proofRequirements: "Photo collage showing flyers posted at multiple locations",
        reward: rewardEach,
        deadlineMinutes: 180,
        dependsOnPrevious: true,
        tags: ["physical-labor", "printing", "marketing"],
        executorType: "human" as const,
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
  const tasks = parsed.tasks as TaskPlan[];

  // Validate and normalize AI task fields
  for (const task of tasks) {
    if (!task.executorType) {
      task.executorType = "human";
    }
    if (task.executorType === "ai") {
      task.reward = "0";
      task.proofRequirements = "N/A - AI executed";
    }
  }

  return tasks;
}
