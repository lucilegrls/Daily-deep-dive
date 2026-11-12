import { useEffect } from "react";

import { sendClientError } from "@/lib/client-error";

export function ClientDiagnostics() {
  useEffect(() => {
    const onError = () => sendClientError("window_error");
    const onRejection = () => sendClientError("unhandled_rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
