import { createClient } from "@supabase/supabase-js";

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

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

export async function getRecommendedTasks(
  workerTags: string[],
  openTaskIds: string[],
): Promise<Array<{ taskId: string; score: number; matchedTags: string[] }>> {
  if (!supabase || workerTags.length === 0 || openTaskIds.length === 0) return [];

  const { data: taskTagRows, error } = await supabase
    .from("task_tags")
    .select("*")
    .in("task_id", openTaskIds);

  if (error) {
    console.error("getRecommendedTasks error:", error);
    return [];
  }
  if (!taskTagRows || taskTagRows.length === 0) return [];

  const normalizedWorkerTags = workerTags.map((t) => t.toLowerCase());

  const results = taskTagRows
    .map((row) => {
      const taskTags: string[] = row.tags ?? [];
      const score = jaccardSimilarity(normalizedWorkerTags, taskTags);
      const matchedTags = taskTags.filter((t: string) =>
        normalizedWorkerTags.includes(t),
      );
      return { taskId: row.task_id as string, score, matchedTags };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return results;
}
