import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { normalizeError } from "@/lib/errors";

interface Options<TData> {
  success?: string | ((data: TData) => string);
  /** Préfixes de clés de cache à invalider après succès (ex. ["products"]). */
  invalidate?: QueryKey[];
  onSuccess?: (data: TData) => void;
  /** true = l'appelant gère l'erreur lui-même (formulaire) : pas de toast automatique. */
  silentError?: boolean;
}

export function useApiMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, opts: Options<TData> = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data) => {
      await Promise.all((opts.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })));
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(data) : opts.success);
      opts.onSuccess?.(data);
    },
    onError: (err) => {
      if (!opts.silentError) toast.error(normalizeError(err).message);
    },
  });
}
