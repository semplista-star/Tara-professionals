"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Avatar from "./Avatar";
import { TaskT, UserLite } from "@/types";

type NotificationT = {
  id: string;
  text: string;
  read: boolean;
  taskId: string | null;
  meetingId: string | null;
  createdAt: string;
};

type PresenceEntry = { online: boolean };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function isToday(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isOverdue(t: TaskT) {
  if (!t.dueDate || t.status === "FET") return false;
  const d = new Date(t.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function fmtRelative(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const PRIORITY_CLASS: Record<string, string> = {
  ALTA: "bg-danger-light text-[#712B13]",
  MITJA: "bg-accent-light text-accent",
  BAIXA: "bg-surface text-inksoft"
};

export default function TodayClient() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id;
  const myName = (session?.user as any)?.name;

  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  const [notifications, setNotifications] = useState<NotificationT[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [tRes, uRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/users")]);
    if (tRes.ok) setTasks(await tRes.json());
    if (uRes.ok) setUsers(await uRes.json());
  }, []);

  const loadPresence = useCallback(async () => {
    const res = await fetch("/api/presence");
    if (!res.ok) return;
    const rows: Array<{ userId: string; online: boolean }> = await res.json();
    const map: Record<string, PresenceEntry> = {};
    for (const r of rows) map[r.userId] = { online: r.online };
    setPresence(map);
  }, []);

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, []);

  useEffect(() => {
    load();
    loadPresence();
    loadNotifications();
    const interval = setInterval(() => {
      load();
      loadPresence();
      loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [load, loadPresence, loadNotifications]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function openBell() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "read-all" }) });
    }
  }

  const myTasks = tasks.filter((t) => t.assignee?.id === myId && t.status !== "FET");
  const dueToday = myTasks.filter((t) => t.dueDate && isToday(t.dueDate));
  const overdue = myTasks.filter(isOverdue);
  const relevant = [...overdue, ...dueToday.filter((t) => !isOverdue(t))].sort(
    (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
  );

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-[22px] font-medium mb-0.5">
            {greeting()}{myName ? `, ${myName.split(" ")[0]}` : ""}
          </h2>
          <p className="text-muted">Esto es lo que te toca hoy.</p>
        </div>

        <div className="relative" ref={bellRef}>
          <button
            onClick={openBell}
            className="relative border border-border rounded-full w-10 h-10 flex items-center justify-center bg-panel hover:bg-surface"
            title="Notificaciones"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-danger" />
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-panel border border-border-strong rounded-xl z-20 p-2">
              {notifications.length === 0 && (
                <p className="text-muted text-xs italic p-2">No tienes notificaciones.</p>
              )}
              {notifications.map((n) => (
                <div key={n.id} className="text-sm px-2 py-2 border-b border-border last:border-0">
                  <p className="text-inksoft">{n.text}</p>
                  <p className="text-[11px] text-muted mt-0.5">{fmtRelative(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="bg-surface border border-border rounded-xl px-4 py-3">
          <div className="text-[28px] font-medium">{dueToday.length}</div>
          <div className="text-[11px] text-muted mt-1">Tareas para ti hoy</div>
        </div>
        <div className="bg-surface border border-border rounded-xl px-4 py-3">
          <div className="text-[28px] font-medium text-danger">{overdue.length}</div>
          <div className="text-[11px] text-muted mt-1">Vencidas</div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-base font-medium mb-3">Para hoy</h3>
        {relevant.length === 0 && (
          <p className="text-muted text-sm italic">No tienes tareas para hoy ni vencidas. Todo al día.</p>
        )}
        <div className="space-y-2">
          {relevant.map((t) => (
            <Link
              key={t.id}
              href="/dashboard/board"
              className="flex items-center justify-between gap-3 bg-panel border border-border rounded-xl p-3 hover:bg-surface"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {isOverdue(t) ? <span className="text-danger">Vencida</span> : "Hoy"}
                </p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${PRIORITY_CLASS[t.priority]}`}>
                {t.priority === "ALTA" ? "Alta" : t.priority === "MITJA" ? "Media" : "Baja"}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-medium mb-3">El equipo ahora mismo</h3>
        <div className="flex flex-wrap gap-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 bg-panel border border-border rounded-full pl-1 pr-3 py-1">
              <Avatar user={u} size={26} online={!!presence[u.id]?.online} />
              <span className="text-xs text-inksoft">{u.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
