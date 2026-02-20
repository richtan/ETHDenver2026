import { createClient } from "@supabase/supabase-js";
import { type AiTaskResult, type AgentAction, type AgentTransaction } from "./types.js";

interface CostEntry { type: "openai" | "gas"; amount_usd: number; details: string; timestamp: number; }
interface RevenueEntry { type: "job_profit" | "ai_service" | "fee"; amount_usd: number; timestamp: number; }
interface ReimbursementEntry { amount_usd: number; txHash: string; timestamp: number; }

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

export async function insertAgentAction(action: AgentAction): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("agent_actions").insert({
    type: action.type,
    job_id: action.jobId ?? null,
    task_id: action.taskId ?? null,
    timestamp: action.timestamp,
    payload: action,
  });
  if (error) console.error("insertAgentAction error:", error);
}

export async function insertAgentTransaction(tx: AgentTransaction): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("agent_transactions").insert({
    action: tx.action,
    hash: tx.hash ?? null,
    amount: tx.amount ?? null,
    timestamp: tx.timestamp,
  });
  if (error) console.error("insertAgentTransaction error:", error);
}

export async function getRecentAgentActions(limit = 200): Promise<AgentAction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("agent_actions")
    .select("payload")
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) { console.error("getRecentAgentActions error:", error); return []; }
  return (data ?? []).map(r => r.payload as AgentAction);
}

export async function getRecentAgentTransactions(limit = 200): Promise<AgentTransaction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("agent_transactions")
    .select("action, hash, amount, timestamp")
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) { console.error("getRecentAgentTransactions error:", error); return []; }
  return (data ?? []) as AgentTransaction[];
}

export async function insertCostEntry(entry: CostEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("cost_entries").insert(entry);
  if (error) console.error("insertCostEntry error:", error);
}

export async function insertRevenueEntry(entry: RevenueEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("revenue_entries").insert(entry);
  if (error) console.error("insertRevenueEntry error:", error);
}

export async function insertReimbursementEntry(entry: ReimbursementEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("reimbursement_entries").insert({
    amount_usd: entry.amount_usd,
    tx_hash: entry.txHash,
    timestamp: entry.timestamp,
  });
  if (error) console.error("insertReimbursementEntry error:", error);
}

export async function getAllCostEntries(): Promise<CostEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cost_entries")
    .select("type, amount_usd, details, timestamp")
    .order("timestamp", { ascending: true });
  if (error) { console.error("getAllCostEntries error:", error); return []; }
  return (data ?? []) as CostEntry[];
}

export async function getAllRevenueEntries(): Promise<RevenueEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("revenue_entries")
    .select("type, amount_usd, timestamp")
    .order("timestamp", { ascending: true });
  if (error) { console.error("getAllRevenueEntries error:", error); return []; }
  return (data ?? []) as RevenueEntry[];
}

export async function getAllReimbursementEntries(): Promise<ReimbursementEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reimbursement_entries")
    .select("amount_usd, tx_hash, timestamp")
    .order("timestamp", { ascending: true });
  if (error) { console.error("getAllReimbursementEntries error:", error); return []; }
  return (data ?? []).map(r => ({ amount_usd: r.amount_usd, txHash: r.tx_hash, timestamp: r.timestamp }));
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
