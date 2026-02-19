import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToIPFS } from "../config/pinata";

export function useUploadProof() {
  const [uploading, setUploading] = useState(false);
  const [ipfsUri, setIpfsUri] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2, maxWidthOrHeight: 1920, useWebWorker: true,
      });
      const uri = await uploadToIPFS(compressed);
      setIpfsUri(uri);
      return uri;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, ipfsUri };
}
