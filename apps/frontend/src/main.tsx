import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { ThemeProvider } from "./context/ThemeProvider.tsx";
import { store } from "./store/store.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
