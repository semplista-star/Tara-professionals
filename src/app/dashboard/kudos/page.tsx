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
  return new Date(iso).toLocaleDateString("ca-ES", { day: "numeric", month: "short" });
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
      <h2 className="font-display text-2xl mb-0.5">Mur de reconeixements</h2>
      <p className="text-muted text-sm mb-6">
        Un lloc per dir-vos "ben fet" quan algú fa alguna cosa bé, sense que calgui que sigui una tasca.
      </p>

      <form onSubmit={submit} className="bg-panel border border-line rounded-md p-4 mb-6 space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted">Reconèixer a</span>
          <select
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            className="border border-line rounded px-2.5 py-1.5 text-sm bg-canvas"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.id === myId ? `${u.name} (tu mateix)` : u.name}</option>
            ))}
          </select>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Per exemple: gràcies per ajudar-me amb el disseny del xat, ha quedat genial"
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
        {kudos.length === 0 && <p className="text-muted text-sm italic">Encara no hi ha cap reconeixement. Comença tu.</p>}
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
