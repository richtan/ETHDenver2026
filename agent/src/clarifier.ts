import OpenAI from "openai";

const openai = new OpenAI();

export interface TaskPreview {
  description: string;
  proofRequirements: string;
  reward: string;
  executorType?: "ai" | "human";
}

export interface ClarifyResult {
  ready: boolean;
  questions?: string[];
  enrichedDescription?: string;
  taskPreview: TaskPreview[];
}

const CLARIFY_PROMPT = `You are TaskMaster, an AI agent that manages real-world tasks. You can execute
some tasks yourself (research, information gathering, web lookups) and delegate physical tasks
to human workers.

Before a job is created, you must gather enough detail to write precise, unambiguous task
requirements.

You will receive:
- A job description from the client
- A budget in ETH
- A conversation history of prior Q&A rounds (may be empty on the first call)

Your job is to decide whether you have enough information to decompose this job into
specific tasks with exact, measurable acceptance criteria.

If ANY of the following are unclear or missing, ask about them:
- Physical dimensions, file formats, resolution, or sizes
- Exact text content, headlines, taglines, or copy
- Brand guidelines, colors, fonts, or style references
- Quantities (how many items, locations, pages, etc.)
- Target audience or intended use
- Specific deliverable format (photo, screenshot, document, etc.)
- Location details (if physical work is involved)
- Any constraints, deadlines, or preferences the client hasn't mentioned

Rules:
- Ask 1-3 focused questions per round. Don't overwhelm the client.
- Build on previous answers — ask follow-up questions that go deeper, not repeat what you already know.
- Only return ready: true when you are confident every task can be completed
  with zero ambiguity about what to produce and how it will be judged.
- Always include a taskPreview — your best guess at the task breakdown given what you know so far.
  Tasks should get more specific with each Q&A round.
- The taskPreview rewards for HUMAN tasks must sum to less than the budget (leave 20-30% agent margin).
- Each human task's proof is always a SINGLE IMAGE (PNG/JPG).
- For each task, include executorType: "ai" if the agent can do it (research, web lookups,
  finding dates/prices, information gathering) or "human" if it requires physical action.
- AI tasks have reward "0" and proofRequirements "N/A - AI executed".
- Minimize human tasks — only use humans where AI truly cannot do the work.

Respond as JSON with this shape:
{
  "ready": false,
  "questions": ["question 1", "question 2"],
  "taskPreview": [
    {
      "description": "What needs to be done",
      "proofRequirements": "Exact criteria the proof image must show (or 'N/A - AI executed')",
      "reward": "0.003",
      "executorType": "human"
    }
  ]
}

OR when ready:
{
  "ready": true,
  "enrichedDescription": "A complete, detailed job brief incorporating all Q&A answers",
  "taskPreview": [...]
}`;

export async function clarifyJob(
  description: string,
  budget: string,
  conversation: Array<{ question: string; answer: string }>,
): Promise<ClarifyResult> {
  if (process.env.MOCK_OPENAI === "true") {
    return {
      ready: true,
      enrichedDescription: description,
      taskPreview: [
        {
          description: "Complete the requested task as described",
          proofRequirements: "Screenshot or photo showing the completed work",
          reward: "0.003",
        },
      ],
    };
  }

  const conversationText = conversation.length > 0
    ? "\n\nPrior Q&A:\n" + conversation.map((qa, i) =>
        `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`
      ).join("\n\n")
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: CLARIFY_PROMPT },
      {
        role: "user",
        content: `Job: "${description}"\nBudget: ${budget} ETH${conversationText}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0].message.content!);
  return parsed as ClarifyResult;
}
