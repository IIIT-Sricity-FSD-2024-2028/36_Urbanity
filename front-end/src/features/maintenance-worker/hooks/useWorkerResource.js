import { useAsyncResource } from "../../../hooks/useAsyncResource.js";

export function useWorkerResource(loader) {
  return useAsyncResource(loader, { preserveDataOnError: true });
}
