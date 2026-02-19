import { useState, useEffect } from "react";
import { AGENT_API_URL } from "../config/wagmi";

export interface AgentAction {
  type: string;
  jobId?: string;
  taskId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface AgentTransaction {
  action: string;
  hash: string;
  amount?: string;
  timestamp: number;
}

export interface Metrics {
  netProfitUsd: number;
  totalRevenueUsd: number;
  totalCostsUsd: number;
  jobsCompleted: number;
  jobsInProgress: number;
  sustainabilityRatio: number;
  costBreakdown: { openai: number; gas: number; workers: number };
  revenueBreakdown: { jobProfits: number; aiServices: number; fees: number };
}

export function useAgentStream() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [transactions, setTransactions] = useState<AgentTransaction[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${AGENT_API_URL}/api/stream`);

    es.onopen = async () => {
      setConnected(true);
      try {
        const [actionsRes, txRes, metricsRes] = await Promise.all([
          fetch(`${AGENT_API_URL}/api/actions`).then(r => r.json()),
          fetch(`${AGENT_API_URL}/api/transactions`).then(r => r.json()),
          fetch(`${AGENT_API_URL}/api/metrics`).then(r => r.json()),
        ]);
        setActions(actionsRes);
        setTransactions(txRes);
        setMetrics(metricsRes);
      } catch { /* Initial load may fail if agent not ready */ }
    };
    es.onerror = () => setConnected(false);

    es.addEventListener("action", (e) => {
      const action = JSON.parse(e.data);
      setActions((prev) => [action, ...prev].slice(0, 100));
    });
    es.addEventListener("metrics", (e) => setMetrics(JSON.parse(e.data)));
    es.addEventListener("transaction", (e) => {
      const tx = JSON.parse(e.data);
      setTransactions((prev) => [tx, ...prev].slice(0, 200));
    });
    return () => es.close();
  }, []);

  return { actions, metrics, transactions, connected };
}
