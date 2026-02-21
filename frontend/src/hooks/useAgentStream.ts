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

export interface PinataUsage {
  bytesUsed: number;
  fileCount: number;
  plan: string;
  storageLimitBytes: number;
  overLimit: boolean;
}

export interface Metrics {
  netProfitUsd: number;
  totalRevenueUsd: number;
  totalCostsUsd: number;
  jobsCompleted: number;
  jobsInProgress: number;
  sustainabilityRatio: number;
  costBreakdown: { openai: number; gas: number; pinata: number; workers: number };
  revenueBreakdown: { jobProfits: number; aiServices: number; fees: number };
  pinataUsage: PinataUsage;
}

export interface OperationLine {
  label: string;
  calls: number;
  costPerCall: number;
  totalCost: number;
}

export interface ProfitDetails {
  openaiLines: OperationLine[];
  gasLines: OperationLine[];
  pinataLines: OperationLine[];
  revenueLines: { label: string; amount: number; count: number }[];
  autonomyMetrics: {
    costCoverageRatio: number;
    revenuePerJob: number;
    costPerJob: number;
    profitMarginPct: number;
    openaiAsCostPct: number;
    gasAsCostPct: number;
    pinataAsCostPct: number;
  };
  pnl: {
    totalRevenue: number;
    openaiCosts: number;
    gasCosts: number;
    pinataCosts: number;
    workerCosts: number;
    netProfit: number;
  };
}

export interface AgentConfig {
  network: string;
  contractAddress: string;
  erc8021Enabled: boolean;
  builderCode: string | null;
  x402Enabled: boolean;
  reimbursementEnabled: boolean;
}

export function useAgentStream() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [transactions, setTransactions] = useState<AgentTransaction[]>([]);
  const [profitDetails, setProfitDetails] = useState<ProfitDetails | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${AGENT_API_URL}/api/stream`);

    es.onopen = async () => {
      setConnected(true);
      try {
        const [actionsRes, txRes, metricsRes, profitRes, configRes] = await Promise.all([
          fetch(`${AGENT_API_URL}/api/actions`).then(r => r.json()),
          fetch(`${AGENT_API_URL}/api/transactions`).then(r => r.json()),
          fetch(`${AGENT_API_URL}/api/metrics`).then(r => r.json()),
          fetch(`${AGENT_API_URL}/api/profit-details`).then(r => r.json()),
          fetch(`${AGENT_API_URL}/api/config`).then(r => r.json()),
        ]);
        setActions(actionsRes);
        setTransactions(txRes);
        setMetrics(metricsRes);
        setProfitDetails(profitRes);
        setAgentConfig(configRes);
      } catch { /* Initial load may fail if agent not ready */ }
    };
    es.onerror = () => setConnected(false);

    es.addEventListener("action", (e) => {
      const action = JSON.parse(e.data);
      setActions((prev) => [action, ...prev].slice(0, 100));
    });
    es.addEventListener("metrics", (e) => {
      setMetrics(JSON.parse(e.data));
      fetch(`${AGENT_API_URL}/api/profit-details`)
        .then(r => r.json())
        .then(setProfitDetails)
        .catch(() => {});
    });
    es.addEventListener("transaction", (e) => {
      const tx = JSON.parse(e.data);
      setTransactions((prev) => [tx, ...prev].slice(0, 200));
    });
    return () => es.close();
  }, []);

  return { actions, metrics, transactions, profitDetails, agentConfig, connected };
}
