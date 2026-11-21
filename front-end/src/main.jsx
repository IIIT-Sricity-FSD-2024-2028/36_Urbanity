import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./app/App.jsx";
import { store } from "./app/store.js";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/layouts.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </Provider>
  </StrictMode>,
);
