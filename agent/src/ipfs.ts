const GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";

export function ipfsToHttpGateway(ipfsUri: string): string {
  if (ipfsUri.startsWith("ipfs://")) {
    return `${GATEWAY}/ipfs/${ipfsUri.slice(7)}`;
  }
  return ipfsUri;
}
