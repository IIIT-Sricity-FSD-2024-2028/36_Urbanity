import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../components/ui/index.js";

export function useWorkerMutation() {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function run(action, message, afterSuccess) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      if (mounted.current) {
        showToast({ type: "success", message });
        await afterSuccess?.();
      }
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || "Unable to update this task.");
        showToast({ type: "error", message: failure.message || "Unable to update this task." });
      }
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { pending, error, run };
}
