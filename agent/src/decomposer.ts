import OpenAI from 'openai';
import { formatEther } from 'viem';
import { type TaskPlan } from './types.js';

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
- relevantAiTasks: array of AI task indices (0-based position in the full task list) whose
  research findings are directly useful for this human task. Omit or use [] for AI tasks.

Executor classification rules:
- "ai": ONLY for pure information lookup — finding facts, prices, dates, regulations,
  specifications, or guidelines that the human worker would not already know.
- "human": Tasks that require physical presence, buying/purchasing items, going to locations,
  taking real-world photos, creating visual designs, printing, posting physical materials,
  physical delivery, or any action a software agent cannot perform.
- NEVER create AI tasks for: generating assets (QR codes, images, logos), downloading or
  obtaining files, creating designs, or any work that produces a file or artifact.
  If the human task needs an asset (e.g., a QR code or logo), include that requirement
  directly in the human task description instead.
- Only create an AI task when it produces information the human genuinely would not know
  and that information materially changes how they do the work. If the job description
  already contains enough detail, skip AI research entirely.
- When in doubt, classify as "human".
- AI tasks should come BEFORE the human tasks they support.
- Minimize the number of AI tasks — one research task covering all needed info is better
  than several narrow ones.

Task merging rules:
- Combine tasks that logically belong to the same person into a single task. For example,
  "print flyers" and "post flyers" should be ONE task: "Print 10 copies and post them at
  prominent campus locations."
- Never split a physical workflow into separate tasks unless a genuinely different skill
  or person is needed (e.g., a graphic designer vs. someone doing physical labor).
- If a task's output is only consumed by the very next task and both require physical
  presence, merge them into one.

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
- Describe WHAT the deliverable should contain, not HOW to make it. The worker knows
  their craft. BAD: "Design an A4 portrait flyer (2480x3508px) ensuring PNG at 300 DPI."
  GOOD: "Design a print-ready flyer with the headline 'Summer Sale 2025', company logo,
  and at least 3 product images."
- NEVER include: file format specs, DPI/resolution, pixel dimensions, tool instructions,
  contact info, email addresses, phone numbers, department names, or step-by-step
  process instructions. Workers decide their own tools and methods.
- Keep descriptions concise — state the key requirements and stop. If the job description
  already specifies details (colors, text, quantities), include those but don't pad with
  implementation details the worker can infer.
- proofRequirements must list checkable criteria a reviewer can verify in the submitted
  image. Keep to 3-5 numbered items max. BAD: "Screenshot of the design".
  GOOD: "Screenshot showing: (1) headline visible, (2) logo included, (3) QR code present."
- NEVER use vague words like "appropriate", "suitable", "nice", "good quality",
  "professional-looking", or "as needed".
- Every requirement must be binary-verifiable: a reviewer can answer yes/no for each one.

Return JSON object with shape: { "tasks": [...], "totalWorkerCost": "0.007", "agentProfit": "0.003" }`;

export async function decomposeJob(
  description: string,
  budget: bigint,
): Promise<TaskPlan[]> {
  console.log('decomposeJob Called');
  if (process.env.MOCK_OPENAI === 'true') {
    const rewardEach = formatEther((budget * 35n) / 100n);
    return [
      {
        description:
          'Research the product specifications, availability, and pricing',
        proofRequirements: 'N/A - AI executed',
        reward: '0',
        deadlineMinutes: 10,
        dependsOnPrevious: false,
        tags: ['research'],
        executorType: 'ai' as const,
      },
      {
        description:
          'Design a promotional flyer with product name, tagline, and key features',
        proofRequirements: 'Screenshot of final design as PNG/JPG',
        reward: rewardEach,
        deadlineMinutes: 120,
        dependsOnPrevious: true,
        tags: ['design', 'marketing', 'graphic-design'],
        executorType: 'human' as const,
      },
      {
        description: 'Print and distribute flyers at the specified locations',
        proofRequirements:
          'Photo collage showing flyers posted at multiple locations',
        reward: rewardEach,
        deadlineMinutes: 180,
        dependsOnPrevious: true,
        tags: ['physical-labor', 'printing', 'marketing'],
        executorType: 'human' as const,
      },
    ];
  }

  console.log(
    `[decomposer] Starting decomposition — "${description}" (budget: ${formatEther(budget)} ETH)`,
  );
  const t0 = performance.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: DECOMPOSE_PROMPT },
      {
        role: 'user',
        content: `Job: "${description}"\nBudget: ${formatEther(budget)} ETH`,
      },
    ],
    response_format: { type: 'json_object' },
  });
  const parsed = JSON.parse(response.choices[0].message.content!);
  const tasks = parsed.tasks as TaskPlan[];

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(
    `[decomposer] Done in ${elapsed}s — ${tasks.length} tasks (${tasks.filter((t) => t.executorType === 'ai').length} AI, ${tasks.filter((t) => t.executorType === 'human').length} human)`,
  );

  // Validate and normalize AI task fields
  for (const task of tasks) {
    if (!task.executorType) {
      task.executorType = 'human';
    }
    if (task.executorType === 'ai') {
      task.reward = '0';
      task.proofRequirements = 'N/A - AI executed';
    }
  }

  return tasks;
}
