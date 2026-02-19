import OpenAI from "openai";
import { type AiTaskResult } from "./types.js";
import { saveAiTaskResult } from "./supabase.js";

const openai = new OpenAI();

const EXECUTOR_PROMPT = `You are an AI research assistant executing a task on behalf of a client.
Your job is to thoroughly complete the following task and produce a clear, structured deliverable.

Task: {description}

{context}

Instructions:
- Be thorough and specific. Include dates, prices, URLs, and concrete details.
- Structure your response clearly with headers and bullet points.
- If the task involves finding information, provide specific sources and references.
- If you cannot fully complete the task, explain what you found and what remains unclear.

Respond as JSON:
{
  "deliverable": "the main text result with all findings, formatted with markdown",
  "keyFacts": ["STRICT: 4 bullets max, each under 80 characters. Only include concrete values a worker needs to act (hex codes, dimensions, key rules). Combine related info into one bullet. NEVER include: contact info, emails, phone numbers, URLs, source references, department names, compliance disclaimers, or anything already stated in the task description. Put all detailed info in the deliverable instead."]
}`;

export async function executeAiTask(
  jobId: string,
  sequenceIndex: number,
  description: string,
  previousResults: AiTaskResult[],
): Promise<AiTaskResult> {
  const context = previousResults.length > 0
    ? "Context from previous research:\n" + previousResults
        .filter(r => r.status === "completed")
        .map(r => `- ${r.description}: ${r.result}`)
        .join("\n")
    : "";

  const prompt = EXECUTOR_PROMPT
    .replace("{description}", description)
    .replace("{context}", context);

  const result: AiTaskResult = {
    id: crypto.randomUUID(),
    job_id: jobId,
    sequence_index: sequenceIndex,
    description,
    status: "in_progress",
    result: "",
    key_facts: [],
    created_at: new Date().toISOString(),
    completed_at: null,
    error: null,
  };

  if (process.env.MOCK_OPENAI === "true") {
    result.result = `Mock AI research result for: ${description}`;
    result.key_facts = ["Mock fact 1", "Mock fact 2"];
    result.status = "completed";
    result.completed_at = new Date().toISOString();
    await saveAiTaskResult(result);
    return result;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content!);
    result.result = parsed.deliverable;
    result.key_facts = parsed.keyFacts ?? [];
    result.status = "completed";
    result.completed_at = new Date().toISOString();
  } catch (err: any) {
    result.status = "failed";
    result.error = err.message;
  }

  await saveAiTaskResult(result);
  return result;
}
