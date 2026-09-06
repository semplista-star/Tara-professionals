"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "./Avatar";
import { MessageT, UserLite } from "@/types";

type PresenceEntry = { online: boolean; typing: boolean };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const EMOJIS = [
  "😀", "😂", "😍", "😉", "😎", "🤔", "😅", "😢", "😡", "😱",
  "👍", "👎", "🙏", "👏", "🙌", "💪", "🤝", "✌️", "🤞", "👋",
  "❤️", "🔥", "🎉", "✅", "❌", "⭐", "💡", "⏰", "📌", "🚀"
];

function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 bg-white border border-line rounded-md shadow-lg p-2 grid grid-cols-6 gap-1 z-10"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="text-lg hover:bg-linesoft rounded p-1"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

async function uploadFile(file: File | Blob, filename: string) {
  const fd = new FormData();
  fd.append("file", file, filename);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  return res.json() as Promise<{ url: string; name: string; type: string }>;
}

export default function ChatClient() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id;

  const [messages, setMessages] = useState<MessageT[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastTypingPingRef = useRef(0);

  const load = useCallback(async (poll: boolean) => {
    const url = poll && lastTsRef.current ? `/api/messages?after=${encodeURIComponent(lastTsRef.current)}` : "/api/messages";
    const res = await fetch(url);
    if (!res.ok) return;
    const data: MessageT[] = await res.json();
    if (data.length === 0) return;
    setMessages((prev) => (poll ? [...prev, ...data] : data));
    lastTsRef.current = data[data.length - 1].createdAt;
  }, []);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(true), 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  const loadPresence = useCallback(async () => {
    const res = await fetch("/api/presence");
    if (!res.ok) return;
    const rows: Array<{ userId: string; online: boolean; typing: boolean }> = await res.json();
    const map: Record<string, PresenceEntry> = {};
    for (const r of rows) map[r.userId] = { online: r.online, typing: r.typing };
    setPresence(map);
  }, []);

  useEffect(() => {
    loadPresence();
    const interval = setInterval(loadPresence, 3000);
    return () => clearInterval(interval);
  }, [loadPresence]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(payload: Partial<MessageT>) {
    await fetch("/api/messages", { method: "POST", body: JSON.stringify(payload) });
    load(true);
  }

  async function deleteMessage(id: string) {
    if (!confirm("¿Borrar este mensaje?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
  }

  function handleTyping(value: string) {
    setText(value);
    const now = Date.now();
    if (now - lastTypingPingRef.current > 3000) {
      lastTypingPingRef.current = now;
      fetch("/api/presence", { method: "POST", body: JSON.stringify({ typing: true }) }).catch(() => {});
    }
  }

  async function handleSend() {
    if (!text.trim()) return;
    const t = text;
    setText("");
    await sendMessage({ text: t });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: "IMAGE" | "FILE") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url, name } = await uploadFile(file, file.name);
      await sendMessage({ attachmentUrl: url, attachmentType: kind, attachmentName: name } as any);
    } finally {
      setUploading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setUploading(true);
        try {
          const { url } = await uploadFile(blob, `nota-de-voz-${Date.now()}.webm`);
          await sendMessage({ attachmentUrl: url, attachmentType: "AUDIO", attachmentName: "Nota de voz" } as any);
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Hay que dar permiso al micrófono para grabar una nota de voz.");
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-2 md:mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg md:text-2xl">Chat del equipo</h2>
        <div className="flex items-center gap-1.5">
          {users.map((u) => (
            <Avatar key={u.id} user={u} size={18} online={!!presence[u.id]?.online} />
          ))}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto bg-panel border border-line rounded-md p-3 md:p-5 space-y-3 md:space-y-4">
        {messages.length === 0 && <p className="text-muted text-sm italic">Todavía no hay mensajes. Empieza tú.</p>}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <Avatar user={m.author} size={32} online={!!presence[m.author.id]?.online} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[13px] font-medium" style={{ color: m.author.color }}>
                  {m.author.id === myId ? "Tu" : m.author.name}
                </span>
                <span className="text-[11px] text-muted">{fmtTime(m.createdAt)}</span>
                {m.author.id === myId && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    className="text-[11px] text-muted hover:text-danger"
                  >
                    Borrar
                  </button>
                )}
              </div>

              {m.text && <p className="text-sm text-inksoft whitespace-pre-wrap">{m.text}</p>}

              {m.attachmentType === "IMAGE" && m.attachmentUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.attachmentUrl} alt={m.attachmentName || "imagen"} className="mt-1.5 max-w-xs rounded-md border border-line" />
              )}
              {m.attachmentType === "AUDIO" && m.attachmentUrl && (
                <audio controls src={m.attachmentUrl} className="mt-1.5 h-9" />
              )}
              {m.attachmentType === "FILE" && m.attachmentUrl && (
                <a
                  href={m.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-sm underline text-inksoft"
                >
                  {m.attachmentName || "Archivo adjunto"}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {uploading && <p className="text-xs text-muted mt-2">Subiendo archivo…</p>}

      <div className="h-4 mt-1.5">
        {(() => {
          const typingNames = users
            .filter((u) => u.id !== myId && presence[u.id]?.typing)
            .map((u) => u.name);
          if (typingNames.length === 0) return null;
          const label =
            typingNames.length === 1
              ? `${typingNames[0]} está escribiendo…`
              : `${typingNames.join(", ")} están escribiendo…`;
          return <p className="text-xs text-muted italic">{label}</p>;
        })()}
      </div>

      <div className="flex items-center gap-1 md:gap-2 relative">
        {showEmojiPicker && (
          <EmojiPicker
            onPick={(emoji) => setText((t) => t + emoji)}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          title="Emojis"
          className="border border-line rounded px-2 py-2 md:px-3 md:py-2.5 text-sm text-muted hover:text-ink flex-shrink-0"
        >
          😀
        </button>
        <label className="cursor-pointer border border-line rounded px-2 py-2 md:px-3 md:py-2.5 text-sm text-muted hover:text-ink flex-shrink-0" title="Adjuntar imagen">
          🖼
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "IMAGE")} />
        </label>
        <label className="cursor-pointer border border-line rounded px-2 py-2 md:px-3 md:py-2.5 text-sm text-muted hover:text-ink flex-shrink-0" title="Adjuntar archivo">
          📎
          <input type="file" className="hidden" onChange={(e) => handleFile(e, "FILE")} />
        </label>
        <button
          onClick={toggleRecording}
          title="Nota de voz"
          className={`border rounded px-2 py-2 md:px-3 md:py-2.5 text-sm flex-shrink-0 ${recording ? "border-danger text-danger" : "border-line text-muted hover:text-ink"}`}
        >
          {recording ? "■" : "🎙"}
        </button>
        <input
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Escribe un mensaje…"
          className="flex-1 min-w-0 border border-line rounded px-2.5 py-2 md:px-3 md:py-2.5 text-sm bg-canvas"
        />
        <button onClick={handleSend} className="bg-ink text-canvas rounded px-3 md:px-5 py-2 md:py-2.5 text-sm flex-shrink-0">
          Enviar
        </button>
      </div>
    </div>
  );
}
