import { useCallback, useEffect, useRef, useState } from "react";

export function useWorkerResource(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const request = useRef(null);
  const mounted = useRef(false);
  const reload = useCallback(async () => {
    if (!mounted.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader(controller.signal);
      if (!controller.signal.aborted && mounted.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) {
        setState((current) => ({ ...current, loading: false, error }));
      }
    }
  }, [loader]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; request.current?.abort(); };
  }, [reload]);
  return { ...state, reload };
}
