import { createClient } from "@supabase/supabase-js";
import { type AiTaskResult } from "./types.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("SUPABASE_URL or SUPABASE_ANON_KEY not set — tag features disabled");
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function getWorkerProfile(address: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("*")
    .eq("wallet_address", address.toLowerCase())
    .single();
  if (error && error.code !== "PGRST116") {
    console.error("getWorkerProfile error:", error);
  }
  return data ?? null;
}

export async function setWorkerTags(address: string, tags: string[]) {
  if (!supabase) throw new Error("Supabase not configured");
  const normalizedTags = tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
  const { data, error } = await supabase
    .from("worker_profiles")
    .upsert(
      {
        wallet_address: address.toLowerCase(),
        tags: normalizedTags,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setTaskTags(taskId: string, tags: string[], jobId: string) {
  if (!supabase) {
    console.warn("Supabase not configured — skipping setTaskTags");
    return null;
  }
  const normalizedTags = tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
  const { data, error } = await supabase
    .from("task_tags")
    .upsert(
      {
        task_id: taskId,
        job_id: jobId,
        tags: normalizedTags,
        created_at: new Date().toISOString(),
      },
      { onConflict: "task_id" },
    )
    .select()
    .single();
  if (error) {
    console.error("setTaskTags error:", error);
    return null;
  }
  return data;
}

export async function getAllTaskTags() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("task_tags").select("*");
  if (error) {
    console.error("getAllTaskTags error:", error);
    return [];
  }
  return data ?? [];
}

export async function saveAiTaskResult(result: AiTaskResult) {
  if (!supabase) {
    console.warn("Supabase not configured — skipping saveAiTaskResult");
    return null;
  }
  const { data, error } = await supabase
    .from("ai_task_results")
    .upsert(result, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("saveAiTaskResult error:", error);
    return null;
  }
  return data;
}

export async function getAiTaskResults(jobId: string): Promise<AiTaskResult[]> {
  if (!supabase) return [];
  const normalizedJobId = String(jobId).trim();
  const { data, error } = await supabase
    .from("ai_task_results")
    .select("*")
    .eq("job_id", normalizedJobId)
    .order("sequence_index", { ascending: true });
  if (error) {
    console.error("getAiTaskResults error:", error);
    return [];
  }
  const results = (data ?? []) as AiTaskResult[];
  // Ensure we only return results for this job (handles DB type coercion edge cases)
  return results.filter((r) => String(r.job_id).trim() === normalizedJobId);
}

function fuzzyTagMatch(workerTag: string, taskTag: string): boolean {
  if (workerTag === taskTag) return true;
  if (workerTag.includes(taskTag) || taskTag.includes(workerTag)) return true;
  const a = workerTag.replace(/[-_\s]/g, "");
  const b = taskTag.replace(/[-_\s]/g, "");
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return false;
}

function tagSimilarity(workerTags: string[], taskTags: string[]): { score: number; matchedTags: string[] } {
  if (workerTags.length === 0 || taskTags.length === 0) return { score: 0, matchedTags: [] };

  const matchedTags: string[] = [];
  let exactMatches = 0;
  let fuzzyMatches = 0;

  for (const tt of taskTags) {
    let matched = false;
    for (const wt of workerTags) {
      if (wt === tt) {
        exactMatches++;
        matched = true;
        break;
      } else if (fuzzyTagMatch(wt, tt)) {
        fuzzyMatches++;
        matched = true;
        break;
      }
    }
    if (matched) matchedTags.push(tt);
  }

  const totalUnique = new Set([...workerTags, ...taskTags]).size;
  const score = (exactMatches + fuzzyMatches * 0.6) / totalUnique;
  return { score, matchedTags };
}

export async function getRecommendedTasks(
  workerTags: string[],
  openTaskIds: string[],
): Promise<Array<{ taskId: string; score: number; matchedTags: string[] }>> {
  if (!supabase || openTaskIds.length === 0) return [];

  const { data: taskTagRows, error } = await supabase
    .from("task_tags")
    .select("*")
    .in("task_id", openTaskIds);

  if (error) {
    console.error("getRecommendedTasks error:", error);
    return [];
  }

  const normalizedWorkerTags = workerTags.map((t) => t.toLowerCase());
  const taggedTaskIds = new Set<string>();

  const scored = (taskTagRows ?? []).map((row) => {
    const taskTags: string[] = row.tags ?? [];
    taggedTaskIds.add(row.task_id as string);
    const { score, matchedTags } = tagSimilarity(normalizedWorkerTags, taskTags);
    return { taskId: row.task_id as string, score, matchedTags };
  });

  for (const id of openTaskIds) {
    if (!taggedTaskIds.has(id)) {
      scored.push({ taskId: id, score: 0, matchedTags: [] });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
