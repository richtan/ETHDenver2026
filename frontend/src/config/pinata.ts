const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

export async function uploadToIPFS(file: File): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error(
      "Pinata JWT not configured. Add PINATA_JWT to .env.local and restart dev.sh.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown error");
    throw new Error(`Pinata upload failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.IpfsHash) {
    throw new Error("Pinata response missing IpfsHash");
  }

  return `ipfs://${data.IpfsHash}`;
}

export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return `${PINATA_GATEWAY}/ipfs/${uri.slice(7)}`;
  return uri;
}
