import { useRef, useState } from "react";
import { useToast } from "../../../components/ui/index.js";
export function useAmenityMutation() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  async function run(request, message, after) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request();
      if (message) showToast({ type: "success", message });
      await after?.(result);
    } catch (e) {
      setError(e.message);
      showToast({ type: "error", message: e.message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError("") };
}
