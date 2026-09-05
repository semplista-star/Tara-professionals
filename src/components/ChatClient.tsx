"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "./Avatar";
import { MessageT } from "@/types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("ca-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  const listRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(payload: Partial<MessageT>) {
    await fetch("/api/messages", { method: "POST", body: JSON.stringify(payload) });
    load(true);
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
          const { url } = await uploadFile(blob, `nota-de-veu-${Date.now()}.webm`);
          await sendMessage({ attachmentUrl: url, attachmentType: "AUDIO", attachmentName: "Nota de veu" } as any);
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Cal donar permís al micròfon per gravar una nota de veu.");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="mb-4">
        <h2 className="font-display text-2xl mb-0.5">Xat de l'equip</h2>
        <p className="text-muted text-sm">Un sol canal compartit per tots cinc.</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto bg-panel border border-line rounded-md p-5 space-y-4">
        {messages.length === 0 && <p className="text-muted text-sm italic">Encara no hi ha missatges. Comença tu.</p>}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <Avatar user={m.author} size={32} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[13px] font-medium" style={{ color: m.author.color }}>
                  {m.author.id === myId ? "Tu" : m.author.name}
                </span>
                <span className="text-[11px] text-muted">{fmtTime(m.createdAt)}</span>
              </div>

              {m.text && <p className="text-sm text-inksoft whitespace-pre-wrap">{m.text}</p>}

              {m.attachmentType === "IMAGE" && m.attachmentUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.attachmentUrl} alt={m.attachmentName || "imatge"} className="mt-1.5 max-w-xs rounded-md border border-line" />
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
                  {m.attachmentName || "Fitxer adjunt"}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {uploading && <p className="text-xs text-muted mt-2">Pujant fitxer…</p>}

      <div className="flex items-center gap-2 mt-3">
        <label className="cursor-pointer border border-line rounded px-3 py-2.5 text-sm text-muted hover:text-ink" title="Adjuntar imatge">
          🖼
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "IMAGE")} />
        </label>
        <label className="cursor-pointer border border-line rounded px-3 py-2.5 text-sm text-muted hover:text-ink" title="Adjuntar arxiu">
          📎
          <input type="file" className="hidden" onChange={(e) => handleFile(e, "FILE")} />
        </label>
        <button
          onClick={toggleRecording}
          title="Nota de veu"
          className={`border rounded px-3 py-2.5 text-sm ${recording ? "border-danger text-danger" : "border-line text-muted hover:text-ink"}`}
        >
          {recording ? "■ Aturar" : "🎙"}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Escriu un missatge…"
          className="flex-1 border border-line rounded px-3 py-2.5 text-sm bg-canvas"
        />
        <button onClick={handleSend} className="bg-ink text-canvas rounded px-5 py-2.5 text-sm">
          Enviar
        </button>
      </div>
    </div>
  );
}
