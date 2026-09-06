"use client";

import { useEffect } from "react";

export default function PresenceHeartbeat() {
  useEffect(() => {
    function ping() {
      fetch("/api/presence", { method: "POST", body: JSON.stringify({}) }).catch(() => {});
    }
    ping();
    const interval = setInterval(ping, 20000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") ping();
    });
    return () => clearInterval(interval);
  }, []);

  return null;
}
