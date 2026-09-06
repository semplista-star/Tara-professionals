"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "unsupported" | "denied" | "off" | "on" | "loading";

export default function NotificationSetup() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    }
    check();
  }, []);

  async function enable() {
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus("off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
      await fetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
    } finally {
      setStatus("off");
    }
  }

  if (status === "unsupported") {
    return <p className="text-xs text-muted">El teu navegador no suporta notificacions push.</p>;
  }
  if (status === "denied") {
    return (
      <p className="text-xs text-muted">
        Has bloquejat les notificacions per aquest lloc. Per activar-les, canvia-ho als permisos del navegador.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted mb-2">
        Rep un avís al mòbil o l'ordinador quan et toqui alguna cosa: una tasca assignada, un comentari o un missatge nou al xat.
      </p>
      {status === "on" ? (
        <button onClick={disable} className="border border-line text-muted rounded px-4 py-2 text-sm hover:text-ink">
          Desactivar notificacions
        </button>
      ) : (
        <button onClick={enable} disabled={status === "loading"} className="bg-ink text-canvas rounded px-4 py-2 text-sm disabled:opacity-60">
          {status === "loading" ? "…" : "Activar notificacions"}
        </button>
      )}
    </div>
  );
}
