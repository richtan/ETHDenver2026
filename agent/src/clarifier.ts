import OpenAI from 'openai';

const openai = new OpenAI();

export interface TaskPreview {
  description: string;
  proofRequirements: string;
  reward: string;
  executorType?: 'ai' | 'human';
}

export interface ClarifyResult {
  ready: boolean;
  questions?: string[];
  enrichedDescription?: string;
  taskPreview: TaskPreview[];
}

const MAX_CLARIFY_ROUNDS = 2;

const CLARIFY_PROMPT = `You are TaskMaster, an AI agent that manages real-world tasks. You can execute
some tasks yourself (research, information gathering, web lookups) and delegate physical tasks
to human workers.

Before a job is created, you gather enough detail to write precise task requirements.

You will receive:
- A job description from the client
- A budget in USD
- A conversation history of prior Q&A rounds (may be empty on the first call)
- The current round number and maximum rounds allowed

Your job is to decide whether you have enough information to decompose this job into
specific tasks with measurable acceptance criteria.

Only ask about things that are truly CRITICAL and MISSING — not nice-to-haves:
- Quantities (how many items, locations, pages, etc.) — only if completely unspecified
- Location details — only if physical work is involved and no location given
- Specific deliverable format — only if genuinely ambiguous

Rules:
- Ask at most 2 focused questions per round. Prefer fewer questions.
- If the job description is reasonably clear, return ready: true immediately on round 0 — do NOT
  ask questions just for the sake of it. Many jobs are straightforward and need no clarification.
- Make reasonable assumptions for minor details instead of asking. State your assumptions
  in the enrichedDescription.
- Build on previous answers — never repeat what you already know.
- When you reach the final round, you MUST return ready: true regardless. Make your best
  assumptions for anything still unclear.
- Always include a taskPreview — your best guess at the task breakdown given what you know so far.
  Tasks should get more specific with each Q&A round.
- The taskPreview rewards for HUMAN tasks must sum to less than the budget (leave 20-30% agent margin).
- Each human task's proof is always a SINGLE IMAGE (PNG/JPG).
- For each task, include executorType: "ai" if the agent can do it (research, web lookups,
  finding dates/prices, information gathering) or "human" if it requires physical action.
- AI tasks have reward "0" and proofRequirements "N/A - AI executed".
- Minimize human tasks — only use humans where AI truly cannot do the work.

Task merging rules:
- Combine tasks that logically belong to the same person into a single task. For example,
  "print flyers" and "post flyers" should be ONE task: "Print 10 copies and post them at
  prominent campus locations."
- Never split a physical workflow into separate tasks unless a genuinely different skill
  or person is needed (e.g., a graphic designer vs. someone doing physical labor).
- If a task's output is only consumed by the very next task and both require physical
  presence, merge them into one.

Respond as JSON with this shape:
{
  "ready": false,
  "questions": ["question 1"],
  "taskPreview": [
    {
      "description": "What needs to be done",
      "proofRequirements": "Exact criteria the proof image must show (or 'N/A - AI executed')",
      "reward": "3.50",
      "executorType": "human"
    }
  ]
}

OR when ready:
{
  "ready": true,
  "enrichedDescription": "A complete, detailed job brief incorporating all Q&A answers and any assumptions made",
  "taskPreview": [...]
}`;

export async function clarifyJob(
  description: string,
  budget: string,
  conversation: Array<{ question: string; answer: string }>,
): Promise<ClarifyResult> {
  if (process.env.MOCK_OPENAI === 'true') {
    return {
      ready: true,
      enrichedDescription: description,
      taskPreview: [
        {
          description: 'Complete the requested task as described',
          proofRequirements: 'Screenshot or photo showing the completed work',
          reward: '3.50',
        },
      ],
    };
  }

  const round = conversation.length;
  const isFinalRound = round >= MAX_CLARIFY_ROUNDS - 1;

  const conversationText =
    conversation.length > 0
      ? '\n\nPrior Q&A:\n' +
        conversation
          .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
          .join('\n\n')
      : '';

  const roundContext = `\n\nRound: ${round} of ${MAX_CLARIFY_ROUNDS} maximum.${
    isFinalRound
      ? ' THIS IS THE FINAL ROUND — you MUST return ready: true.'
      : ''
  }`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: CLARIFY_PROMPT },
      {
        role: 'user',
        content: `Job: "${description}"\nBudget: $${budget} USD${conversationText}${roundContext}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(response.choices[0].message.content!);
  const result = parsed as ClarifyResult;

  if (isFinalRound && !result.ready) {
    result.ready = true;
    result.enrichedDescription = result.enrichedDescription || description;
    result.questions = undefined;
  }

  return result;
}
