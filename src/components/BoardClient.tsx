"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import confetti from "canvas-confetti";
import Avatar from "./Avatar";
import { TaskT, UserLite } from "@/types";

function celebrate() {
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ["#3E7C74", "#C97B3C", "#A85751", "#5B7A9D"] });
}

const STATUS_LABEL: Record<string, string> = { PENDENT: "Pendiente", CURS: "En curso", FET: "Hecho" };
const STATUS_COLOR: Record<string, string> = { PENDENT: "bg-pendent", CURS: "bg-curs", FET: "bg-fet" };
const PRIORITY_LABEL: Record<string, string> = { ALTA: "Alta", MITJA: "Media", BAIXA: "Baja" };
const PRIORITY_CLASS: Record<string, string> = {
  ALTA: "bg-[#F3E3E0] text-danger",
  MITJA: "bg-[#F5EAD3] text-[#8A6A1F]",
  BAIXA: "bg-[#E6EDEC] text-[#6F8B87]"
};

function isOverdue(t: TaskT) {
  if (!t.dueDate || t.status === "FET") return false;
  const d = new Date(t.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function BoardClient() {
  const { data: session } = useSession();
  const myId = (session?.user as any)?.id;

  const [tasks, setTasks] = useState<TaskT[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const load = useCallback(async () => {
    const [tRes, uRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/users")]);
    if (tRes.ok) setTasks(await tRes.json());
    if (uRes.ok) setUsers(await uRes.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const detail = tasks.find((t) => t.id === detailId) || null;
  const editing = tasks.find((t) => t.id === editingId) || null;

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: String(fd.get("title") || ""),
      description: String(fd.get("description") || ""),
      assigneeId: String(fd.get("assigneeId") || "") || null,
      priority: String(fd.get("priority") || "MITJA"),
      status: String(fd.get("status") || "PENDENT"),
      dueDate: String(fd.get("dueDate") || "") || null
    };
    if (!payload.title.trim()) return;

    if (editingId) {
      if (payload.status === "FET" && editing?.status !== "FET") celebrate();
      await fetch(`/api/tasks/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await fetch("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    }
    setFormOpen(false);
    setEditingId(null);
    load();
  }

  async function moveTask(id: string, status: string) {
    const current = tasks.find((t) => t.id === id);
    if (status === "FET" && current?.status !== "FET") celebrate();
    await fetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }
  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setDetailId(null);
    load();
  }
  async function addComment() {
    if (!commentText.trim() || !detailId) return;
    await fetch(`/api/tasks/${detailId}/comments`, { method: "POST", body: JSON.stringify({ text: commentText }) });
    setCommentText("");
    load();
  }

  const columns: Array<"PENDENT" | "CURS" | "FET"> = ["PENDENT", "CURS", "FET"];
  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.assignee?.id === filter);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="font-display text-2xl mb-0.5">Tablero completo</h2>
          <p className="text-muted text-sm">
            Todas las tareas del equipo. Puedes asignar una a cualquier compañero sin entrar en su perfil.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
          className="bg-ink text-canvas rounded px-4 py-2.5 text-sm whitespace-nowrap"
        >
          + Nueva tarea
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          ["Total", tasks.length, ""],
          ["Pendientes", tasks.filter((t) => t.status === "PENDENT").length, ""],
          ["En curso", tasks.filter((t) => t.status === "CURS").length, ""],
          ["Hechas", tasks.filter((t) => t.status === "FET").length, ""],
          ["Vencidas", tasks.filter(isOverdue).length, "text-danger"]
        ].map(([label, num, cls]) => (
          <div key={label as string} className="bg-panel border border-line rounded-md px-4 py-3">
            <div className={`font-display text-2xl ${cls}`}>{num as number}</div>
            <div className="text-[11px] text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilter("all")}
          className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs ${
            filter === "all" ? "border-ink text-ink" : "border-line text-muted"
          }`}
        >
          Todos <span className="bg-linesoft rounded-full px-1.5 text-[10px]">{tasks.length}</span>
        </button>
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setFilter(u.id)}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs ${
              filter === u.id ? "border-ink text-ink" : "border-line text-muted"
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: u.color }} />
            {u.name}
            <span className="bg-linesoft rounded-full px-1.5 text-[10px]">
              {tasks.filter((t) => t.assignee?.id === u.id).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col);
          return (
            <div key={col} className="bg-white/40 border border-linesoft rounded-md p-3.5 min-h-[100px]">
              <div className="flex items-center gap-2 text-xs text-muted mb-3">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[col]}`} />
                {STATUS_LABEL[col]}
                <span className="ml-auto">{colTasks.length}</span>
              </div>
              {colTasks.length === 0 && <p className="text-xs text-muted italic">Sin tareas aquí.</p>}
              {colTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setDetailId(t.id)}
                  className="bg-panel border border-line rounded p-3 mb-2.5 cursor-pointer hover:border-inksoft"
                >
                  <div className="flex justify-between gap-2 mb-1">
                    <p className="text-sm font-medium leading-snug">{t.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap h-fit ${PRIORITY_CLASS[t.priority]}`}>
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted mb-2 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.assignee?.color || "#999" }} />
                      {t.assignee?.name || "Sin asignar"}
                    </span>
                    {t.dueDate && (
                      <span className={isOverdue(t) ? "text-danger font-medium" : "text-muted"}>
                        {isOverdue(t) ? "Vencida " : ""}
                        {fmtDate(t.dueDate)}
                      </span>
                    )}
                  </div>
                  {t.comments.length > 0 && (
                    <p className="text-[11px] text-muted mt-1.5">
                      {t.comments.length} comentario{t.comments.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Modal crear/editar */}
      {formOpen && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-5 z-20" onClick={() => setFormOpen(false)}>
          <form
            onSubmit={submitForm}
            onClick={(e) => e.stopPropagation()}
            className="bg-panel rounded-lg p-6 w-full max-w-md border border-line space-y-3"
          >
            <h3 className="font-display text-lg mb-1">{editingId ? "Editar tarea" : "Nueva tarea"}</h3>
            <div>
              <label className="block text-xs text-muted mb-1">Título</label>
              <input name="title" defaultValue={editing?.title} required className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Descripción</label>
              <textarea name="description" defaultValue={editing?.description || ""} className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Asignado a</label>
                <select name="assigneeId" defaultValue={editing?.assignee?.id || myId} className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Prioridad</label>
                <select name="priority" defaultValue={editing?.priority || "MITJA"} className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas">
                  <option value="ALTA">Alta</option>
                  <option value="MITJA">Media</option>
                  <option value="BAIXA">Baja</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Estado</label>
                <select name="status" defaultValue={editing?.status || "PENDENT"} className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas">
                  <option value="PENDENT">Pendiente</option>
                  <option value="CURS">En curso</option>
                  <option value="FET">Hecho</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Fecha límite</label>
                <input type="date" name="dueDate" defaultValue={editing?.dueDate?.slice(0, 10) || ""} className="w-full border border-line rounded px-3 py-2 text-sm bg-canvas" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="border border-line text-muted rounded px-4 py-2 text-sm">
                Cancelar
              </button>
              <button type="submit" className="bg-ink text-canvas rounded px-4 py-2 text-sm">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal detall + comentaris */}
      {detail && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-5 z-20" onClick={() => setDetailId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-panel rounded-lg p-6 w-full max-w-lg border border-line max-h-[88vh] overflow-y-auto">
            <h3 className="font-display text-lg mb-2">{detail.title}</h3>
            <div className="flex flex-wrap gap-4 text-xs text-muted mb-3">
              <span className="flex items-center gap-1.5">
                <Avatar user={detail.assignee} size={18} /> {detail.assignee?.name || "Sin asignar"}
              </span>
              <span className={`px-2 py-0.5 rounded ${PRIORITY_CLASS[detail.priority]}`}>{PRIORITY_LABEL[detail.priority]}</span>
              {detail.dueDate && <span className={isOverdue(detail) ? "text-danger" : ""}>{fmtDate(detail.dueDate)}</span>}
            </div>
            {detail.description && <p className="text-sm text-inksoft mb-4 whitespace-pre-wrap">{detail.description}</p>}

            <div className="mb-4">
              <label className="block text-xs text-muted mb-1">Estado</label>
              <select
                value={detail.status}
                onChange={(e) => moveTask(detail.id, e.target.value)}
                className="border border-line rounded px-3 py-1.5 text-sm bg-canvas"
              >
                <option value="PENDENT">Pendiente</option>
                <option value="CURS">En curso</option>
                <option value="FET">Hecho</option>
              </select>
            </div>

            <div className="border-t border-linesoft pt-3">
              <p className="text-xs text-muted mb-2">Comentarios</p>
              <div className="space-y-2 mb-3">
                {detail.comments.length === 0 && <p className="text-xs text-muted italic">Todavía no hay comentarios.</p>}
                {detail.comments.map((c) => (
                  <div key={c.id} className="bg-canvas rounded px-3 py-2 text-sm">
                    <div className="flex justify-between text-[11px] text-muted mb-0.5">
                      <span>{c.author.name}</span>
                      <span>{fmtDate(c.createdAt)}</span>
                    </div>
                    {c.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder="Escribe un comentario…"
                  className="flex-1 border border-line rounded px-3 py-2 text-sm bg-canvas"
                />
                <button onClick={addComment} className="bg-ink text-canvas rounded px-4 text-sm">
                  Enviar
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center mt-5 pt-3 border-t border-linesoft">
              <button onClick={() => deleteTask(detail.id)} className="text-danger text-xs">
                Eliminar tarea
              </button>
              <div className="flex gap-2">
                <button onClick={() => setDetailId(null)} className="border border-line text-muted rounded px-4 py-2 text-sm">
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    setEditingId(detail.id);
                    setDetailId(null);
                    setFormOpen(true);
                  }}
                  className="bg-ink text-canvas rounded px-4 py-2 text-sm"
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
