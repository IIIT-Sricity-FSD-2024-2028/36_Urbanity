import { useCallback, useEffect, useRef, useState } from "react";

// Loads data for a Tower Representative page. Responses from superseded or
// unmounted requests are ignored so a slow request never overwrites newer data.
export function useTowerResource(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await loader();
      if (requestId === requestRef.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (requestId === requestRef.current) setState({ data: null, error, loading: false });
      return null;
    }
  }, [loader]);

  useEffect(() => {
    reload();
    return () => { requestRef.current += 1; };
  }, [reload]);

  return { ...state, initialLoading: state.loading && !state.data, reload };
}
