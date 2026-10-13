import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncResource(loader, { preserveDataOnError = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const requestRef = useRef(0);
  const controllerRef = useRef(null);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, error: null, loading: true }));

    try {
      const data = await loader(controller.signal);
      if (requestId === requestRef.current && !controller.signal.aborted) {
        setState({ data, error: null, loading: false });
      }
      return data;
    } catch (error) {
      if (requestId === requestRef.current && !controller.signal.aborted) {
        setState((current) => ({
          data: preserveDataOnError ? current.data : null,
          error,
          loading: false,
        }));
      }
      return null;
    }
  }, [loader, preserveDataOnError]);

  useEffect(() => {
    reload();
    return () => {
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [reload]);

  const setData = useCallback((data) => {
    setState((current) => ({
      data: typeof data === "function" ? data(current.data) : data,
      error: null,
      loading: false,
    }));
  }, []);

  return {
    ...state,
    initialLoading: state.loading && state.data === null,
    reload,
    setData,
  };
}
