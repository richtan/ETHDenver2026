const rawGateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
const GATEWAY = rawGateway.startsWith("http") ? rawGateway : `https://${rawGateway}`;

export function ipfsToHttpGateway(ipfsUri: string): string {
  if (ipfsUri.startsWith("ipfs://")) {
    return `${GATEWAY}/ipfs/${ipfsUri.slice(7)}`;
  }
  return ipfsUri;
}

export async function fetchIpfsJson(ipfsUri: string): Promise<unknown> {
  const url = ipfsToHttpGateway(ipfsUri);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch IPFS JSON: ${res.status}`);
  return res.json();
}
