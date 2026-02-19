const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

export async function uploadToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return `${PINATA_GATEWAY}/ipfs/${uri.slice(7)}`;
  return uri;
}
