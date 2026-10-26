// @ts-nocheck -- original Hisaaboo code, type-checked loosely
import App from "./App";
import { EscapeStackProvider } from "./hooks/useEscapeStack";

export default function Root() {
  return (
    <EscapeStackProvider>
      <App />
    </EscapeStackProvider>
  );
}
