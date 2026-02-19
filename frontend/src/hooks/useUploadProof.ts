import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToIPFS, uploadJsonToIPFS } from "../config/pinata";

export function useUploadProof() {
  const [uploading, setUploading] = useState(false);
  const [ipfsUri, setIpfsUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  async function upload(files: File[]) {
    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: files.length });
    try {
      const imageUris: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await imageCompression(files[i], {
          maxSizeMB: 0.2, maxWidthOrHeight: 1920, useWebWorker: true,
        });
        const uri = await uploadToIPFS(compressed);
        imageUris.push(uri);
        setProgress({ done: i + 1, total: files.length });
      }

      let finalUri: string;
      if (imageUris.length === 1) {
        finalUri = imageUris[0];
      } else {
        finalUri = await uploadJsonToIPFS({ images: imageUris });
      }
      setIpfsUri(finalUri);
      return finalUri;
    } catch (err: any) {
      const msg = err?.message || "Upload failed";
      setError(msg);
      setIpfsUri(null);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setIpfsUri(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  }

  return { upload, uploading, ipfsUri, error, progress, reset };
}
