// @ts-nocheck -- original Hisaaboo code, type-checked loosely
import App from "./App";
import { Toaster } from "sonner";
import { EscapeStackProvider } from "./hooks/useEscapeStack";

export default function Root() {
  return (
    <EscapeStackProvider>
      <App />
      <Toaster position="top-center" richColors closeButton duration={3000} />
    </EscapeStackProvider>
  );
}
