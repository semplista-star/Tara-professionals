"use client";

import { useEffect, useState } from "react";
import { PersonalFileT } from "@/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType === "application/pdf") return "📄";
  return "📎";
}

export default function PersonalFilesPage() {
  const [files, setFiles] = useState<PersonalFileT[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/personal-files");
    if (res.ok) setFiles(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error();
      const { url, name, type } = await uploadRes.json();

      const saveRes = await fetch("/api/personal-files", {
        method: "POST",
        body: JSON.stringify({ url, name, mimeType: type || "application/octet-stream" })
      });
      if (!saveRes.ok) throw new Error();
      await load();
    } catch {
      setError("No se ha podido subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Seguro que quieres borrar este archivo?")) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/personal-files/${id}`, { method: "DELETE" });
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl mb-0.5">Espacio personal</h2>
      <p className="text-muted text-sm mb-6">
        Archivos privados tuyos. Nadie más del equipo puede verlos.
      </p>

      <label className="inline-flex items-center gap-2 cursor-pointer border border-line rounded px-4 py-2.5 text-sm text-inksoft hover:bg-linesoft mb-6">
        {uploading ? "Subiendo…" : "＋ Subir archivo (PDF o imagen)"}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {loading && <p className="text-muted text-sm italic">Cargando…</p>}
      {!loading && files.length === 0 && (
        <p className="text-muted text-sm italic">Todavía no has subido ningún archivo.</p>
      )}

      <div className="space-y-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 border border-line rounded-md p-3 bg-panel">
            {f.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt={f.name} className="w-10 h-10 object-cover rounded border border-line flex-shrink-0" />
            ) : (
              <span className="text-xl flex-shrink-0">{fileIcon(f.mimeType)}</span>
            )}
            <div className="min-w-0 flex-1">
              <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-inksoft underline truncate block">
                {f.name}
              </a>
              <span className="text-[11px] text-muted">{fmtDate(f.createdAt)}</span>
            </div>
            <button onClick={() => handleDelete(f.id)} className="text-xs text-danger hover:underline flex-shrink-0">
              Borrar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
