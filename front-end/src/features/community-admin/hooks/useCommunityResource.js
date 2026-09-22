import { useCallback, useEffect, useState } from "react";

export function useCommunityResource(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await loader();
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      setState({ data: null, error, loading: false });
      return null;
    }
  }, [loader]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
