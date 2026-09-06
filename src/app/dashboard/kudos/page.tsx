"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/Avatar";
import { UserLite } from "@/types";

type KudoT = {
  id: string;
  text: string;
  giver: UserLite;
  receiver: UserLite;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function KudosPage() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id;

  const [kudos, setKudos] = useState<KudoT[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [receiverId, setReceiverId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [kRes, uRes] = await Promise.all([fetch("/api/kudos"), fetch("/api/users")]);
    if (kRes.ok) setKudos(await kRes.json());
    if (uRes.ok) {
      const list: UserLite[] = await uRes.json();
      setUsers(list);
      setReceiverId((prev) => prev || list.find((u) => u.id !== myId)?.id || "");
    }
  }, [myId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !receiverId) return;
    setSending(true);
    try {
      await fetch("/api/kudos", { method: "POST", body: JSON.stringify({ text, receiverId }) });
      setText("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl mb-0.5">Muro de reconocimientos</h2>
      <p className="text-muted text-sm mb-2">
        Un lugar para deciros "bien hecho" cuando alguien hace algo bien, sin que tenga que ser una tarea.
      </p>
      <p className="inline-flex items-center gap-1.5 bg-[#E6EDEC] text-[#4F6B67] rounded-full px-3 py-1 text-xs mb-6">
        🌱 Ley 6 de Tara: reconocer el progreso — aplicada a vosotros mismos.
      </p>

      <form onSubmit={submit} className="bg-panel border border-line rounded-md p-4 mb-6 space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted">Reconocer a</span>
          <select
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            className="border border-line rounded px-2.5 py-1.5 text-sm bg-canvas"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.id === myId ? `${u.name} (tú mismo)` : u.name}</option>
            ))}
          </select>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Por ejemplo: gracias por ayudarme con el diseño del chat, ha quedado genial"
          className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas min-h-[70px]"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="bg-ink text-canvas rounded px-5 py-2 text-sm disabled:opacity-60"
        >
          {sending ? "…" : "Publicar"}
        </button>
      </form>

      <div className="space-y-3">
        {kudos.length === 0 && <p className="text-muted text-sm italic">Todavía no hay ningún reconocimiento. Empieza tú.</p>}
        {kudos.map((k) => (
          <div key={k.id} className="bg-panel border border-line rounded-md p-4 flex gap-3">
            <Avatar user={k.giver} size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium" style={{ color: k.giver.color }}>{k.giver.name}</span>
                <span className="text-muted"> → </span>
                <span className="font-medium" style={{ color: k.receiver.color }}>{k.receiver.name}</span>
              </p>
              <p className="text-sm text-inksoft mt-1 whitespace-pre-wrap">{k.text}</p>
              <p className="text-[11px] text-muted mt-1.5">{fmtDate(k.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
