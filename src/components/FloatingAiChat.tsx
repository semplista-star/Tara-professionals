"use client";

import { useEffect, useRef, useState } from "react";

type ChatMode = "tara" | "team";
type ChatMessage = { role: "user" | "assistant"; content: string };

const MODE_LABEL: Record<ChatMode, string> = {
  tara: "Tara (demo)",
  team: "Asistente del equipo"
};

export default function FloatingAiChat() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("team");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading]);

  function switchMode(next: ChatMode) {
    if (next === mode) return;
    setMode(next);
    setMessages([]);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        body: JSON.stringify({ mode, messages: next })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text || "" }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error || "Error"}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ No se ha podido conectar." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed z-40 bottom-[152px] right-4 md:bottom-24 md:right-6 w-[calc(100vw-2rem)] max-w-sm bg-panel border border-border-strong rounded-xl flex flex-col h-[70vh] max-h-[520px]">
          <div className="p-3 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Asistente</span>
              <div className="flex items-center gap-3">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    title="Borrar esta conversación"
                    className="text-muted hover:text-danger text-xs"
                  >
                    Borrar chat
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted hover:text-ink text-sm">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex bg-surface rounded-full p-0.5 text-xs">
              {(["tara", "team"] as ChatMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 rounded-full py-1.5 transition-colors ${
                    mode === m ? "bg-accent text-white" : "text-muted"
                  }`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            {mode === "tara" && (
              <p className="text-[10px] text-danger mt-1.5">
                Modo Tara: ejemplos y pruebas, no lo uses con adolescentes reales aquí.
              </p>
            )}
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-muted text-xs italic">
                {mode === "tara" ? "Habla con Tara (modo demo)." : "Pregúntame lo que necesites sobre el proyecto."}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && mode === "tara" && (
                  <span className="w-6 h-6 rounded-full bg-fet text-white text-[11px] font-display flex items-center justify-center flex-shrink-0">
                    T
                  </span>
                )}
                <div
                  className={`text-sm rounded-lg px-3 py-2 max-w-[80%] whitespace-pre-wrap ${
                    m.role === "user" ? "bg-accent text-white" : "bg-canvas text-inksoft border border-border"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <p className="text-muted text-xs italic">Escribiendo…</p>}
          </div>

          <div className="p-2.5 border-t border-border flex gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribe un mensaje…"
              className="flex-1 min-w-0 border border-border rounded-lg px-2.5 py-2 text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="bg-accent text-white rounded-lg px-3 py-2 text-sm disabled:opacity-60 flex-shrink-0"
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center text-xl"
        title="Asistente"
      >
        {open ? "✕" : "💬"}
      </button>
    </>
  );
}
