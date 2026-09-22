import { useCallback, useEffect, useRef, useState } from "react";

export function useResidentResource(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setState((current) => ({ data: current.data, loading: true, error: null }));
    try {
      const data = await loader();
      if (request === sequence.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (request === sequence.current) setState({ data: null, loading: false, error });
    }
  }, [loader]);

  useEffect(() => {
    reload();
    return () => { sequence.current += 1; };
  }, [reload]);

  return { ...state, reload };
}
