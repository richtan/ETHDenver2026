import { useState, useEffect } from "react";

const CACHE_TTL = 60_000;
const FALLBACK_PRICE = 2500;

let cachedPrice: number | null = null;
let cachedAt = 0;

async function fetchEthPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedAt < CACHE_TTL) return cachedPrice;
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const data = await res.json();
    cachedPrice = data.ethereum.usd;
    cachedAt = Date.now();
    return cachedPrice!;
  } catch {
    return cachedPrice ?? FALLBACK_PRICE;
  }
}

export function useEthPrice() {
  const [ethPrice, setEthPrice] = useState<number | null>(cachedPrice);
  const [isLoading, setIsLoading] = useState(cachedPrice === null);

  useEffect(() => {
    let cancelled = false;
    fetchEthPrice().then((price) => {
      if (!cancelled) {
        setEthPrice(price);
        setIsLoading(false);
      }
    });
    const interval = setInterval(() => {
      fetchEthPrice().then((price) => {
        if (!cancelled) setEthPrice(price);
      });
    }, CACHE_TTL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { ethPrice, isLoading };
}
