import { configureStore } from "@reduxjs/toolkit";
import { subscribeSessionChanges } from "../api/client.js";
import { urbanityApi } from "../api/urbanityApi.js";

export function createAppStore(additionalMiddleware = []) {
  return configureStore({
    reducer: { [urbanityApi.reducerPath]: urbanityApi.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(urbanityApi.middleware, additionalMiddleware),
  });
}

export const store = createAppStore();

const unsubscribe = subscribeSessionChanges(() => {
  // RTK Query cancels in-flight work when the API state is reset.
  store.dispatch(urbanityApi.util.resetApiState());
});

if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
