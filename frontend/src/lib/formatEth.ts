import { formatEther } from "viem";

export function formatEth(wei: bigint, decimals = 4): string {
  const eth = formatEther(wei);
  const num = parseFloat(eth);
  return num.toFixed(decimals);
}

export function usdToEth(usd: number, ethPrice: number): string {
  if (ethPrice <= 0) return "0";
  return (usd / ethPrice).toFixed(6);
}

export function ethToUsd(wei: bigint, ethPrice: number): string {
  const eth = parseFloat(formatEther(wei));
  return (eth * ethPrice).toFixed(2);
}

export function formatUsd(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0.00";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
