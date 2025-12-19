import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ToastProvider } from "./context/ToastContext";
import { UserProvider } from "./context/UserContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <UserProvider>
        <OnboardingProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </OnboardingProvider>
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);
