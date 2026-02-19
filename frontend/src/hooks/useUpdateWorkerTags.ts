import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AGENT_API_URL } from "../config/wagmi";

export function useUpdateWorkerTags(address: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tags: string[]) => {
      if (!address) throw new Error("No address");
      const res = await fetch(`${AGENT_API_URL}/api/worker/${address}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error("Failed to update tags");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workerProfile", address] });
      queryClient.invalidateQueries({ queryKey: ["recommendedTasks", address] });
    },
  });
}
