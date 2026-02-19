import { config } from "./config.js";
import { formatEther } from "viem";

let cachedPrice: number | null = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getEthPrice(): Promise<number> {
  if (config.priceFeedMode === "fixed") {
    return config.fixedEthPrice;
  }
  if (cachedPrice && Date.now() - cachedAt < CACHE_TTL) {
    return cachedPrice;
  }
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  const data = await res.json();
  cachedPrice = data.ethereum.usd;
  cachedAt = Date.now();
  return cachedPrice!;
}

export async function ethToUsd(weiAmount: bigint): Promise<number> {
  const price = await getEthPrice();
  return Number(formatEther(weiAmount)) * price;
}

export async function usdToEth(usdAmount: number): Promise<number> {
  const price = await getEthPrice();
  return usdAmount / price;
}
