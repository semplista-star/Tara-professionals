"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/Avatar";
import { MeetingT, UserLite } from "@/types";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === tomorrow.toDateString()) return "Mañana";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function groupByDay(meetings: MeetingT[]) {
  const groups: { key: string; label: string; items: MeetingT[] }[] = [];
  for (const m of meetings) {
    const key = new Date(m.startsAt).toDateString();
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: dayLabel(m.startsAt), items: [] };
      groups.push(group);
    }
    group.items.push(m);
  }
  return groups;
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id;

  const [meetings, setMeetings] = useState<MeetingT[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [mRes, uRes] = await Promise.all([fetch("/api/meetings"), fetch("/api/users")]);
    if (mRes.ok) setMeetings(await mRes.json());
    if (uRes.ok) setUsers(await uRes.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (formOpen && myId) setParticipantIds([myId]);
  }, [formOpen, myId]);

  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.startsAt).getTime() >= now);
  const past = meetings
    .filter((m) => new Date(m.startsAt).getTime() < now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") || "");
    const time = String(fd.get("time") || "");
    if (!date || !time || participantIds.length === 0) return;

    const payload = {
      title: String(fd.get("title") || ""),
      description: String(fd.get("description") || ""),
      location: String(fd.get("location") || ""),
      durationMinutes: Number(fd.get("durationMinutes") || 30),
      startsAt: new Date(`${date}T${time}`).toISOString(),
      participantIds
    };
    if (!payload.title.trim()) return;

    await fetch("/api/meetings", { method: "POST", body: JSON.stringify(payload) });
    setFormOpen(false);
    load();
  }

  async function deleteMeeting(id: string) {
    if (!confirm("¿Seguro que quieres cancelar esta reunión?")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    load();
  }

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function MeetingCard({ m, past: isPast }: { m: MeetingT; past?: boolean }) {
    return (
      <div className={`bg-panel border border-line rounded-md p-3.5 ${isPast ? "opacity-60" : ""}`}>
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{m.title}</p>
            <p className="text-xs text-muted mt-0.5">
              {timeLabel(m.startsAt)} · {m.durationMinutes} min
              {m.location && <> · {m.location}</>}
            </p>
            {m.description && <p className="text-xs text-inksoft mt-1.5 whitespace-pre-wrap">{m.description}</p>}
          </div>
          {!isPast && m.creator.id === myId && (
            <button onClick={() => deleteMeeting(m.id)} className="text-danger text-xs flex-shrink-0">
              Cancelar
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2.5">
          <div className="flex -space-x-1.5">
            {m.participants.map((p) => (
              <Avatar key={p.id} user={p} size={22} />
            ))}
          </div>
          <span className="text-[11px] text-muted ml-1">
            {m.participants.length === users.length ? "Todo el equipo" : m.participants.map((p) => p.name).join(", ")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="font-display text-2xl mb-0.5">Calendario</h2>
          <p className="text-muted text-sm">Reuniones del equipo, agrupadas por día.</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="bg-ink text-canvas rounded px-4 py-2.5 text-sm whitespace-nowrap">
          + Nueva reunión
        </button>
      </div>

      {upcoming.length === 0 && <p className="text-muted text-sm italic mb-6">No hay ninguna reunión agendada.</p>}

      <div className="space-y-5 mb-8">
        {groupByDay(upcoming).map((group) => (
          <div key={group.key}>
            <p className="text-xs text-muted mb-2 capitalize">{group.label}</p>
            <div className="space-y-2">
              {group.items.map((m) => (
                <MeetingCard key={m.id} m={m} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {past.length > 0 && (
        <div className="border-t border-linesoft pt-4">
          <button onClick={() => setShowPast((v) => !v)} className="text-sm text-muted hover:text-ink mb-3">
            {showPast ? "▾" : "▸"} Historial de reuniones pasadas ({past.length})
          </button>
          {showPast && (
            <div className="space-y-2">
              {past.map((m) => (
                <MeetingCard key={m.id} m={m} past />
              ))}
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-5 z-20" onClick={() => setFormOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="bg-panel rounded-lg p-6 w-full max-w-md border border-line space-y-3 max-h-[88vh] overflow-y-auto"
          >
            <h3 className="font-display text-lg mb-1">Nueva reunión</h3>
            <div>
              <label className="block text-xs text-muted mb-1">Título</label>
              <input name="title" required className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Fecha</label>
                <input type="date" name="date" required className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Hora</label>
                <input type="time" name="time" required className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Duración</label>
                <select name="durationMinutes" defaultValue="30" className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas">
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hora</option>
                  <option value="90">1,5 horas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Lugar o enlace</label>
                <input name="location" placeholder="Meet, oficina…" className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Notas</label>
              <textarea name="description" className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas min-h-[60px]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-muted">Asistentes</label>
                <button
                  type="button"
                  onClick={() => setParticipantIds(users.map((u) => u.id))}
                  className="text-[11px] text-muted underline"
                >
                  Todo el equipo
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggleParticipant(u.id)}
                    className={`flex items-center gap-1.5 border rounded-full pl-1 pr-3 py-1 text-xs ${
                      participantIds.includes(u.id) ? "border-ink text-ink" : "border-line text-muted"
                    }`}
                  >
                    <Avatar user={u} size={18} />
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="border border-line text-muted rounded px-4 py-2 text-sm">
                Cancelar
              </button>
              <button type="submit" className="bg-ink text-canvas rounded px-4 py-2 text-sm">
                Agendar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
