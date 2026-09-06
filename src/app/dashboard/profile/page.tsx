"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/Avatar";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user as any;

  const [name, setName] = useState(user?.name || "");
  const [newPassword, setNewPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url } = await res.json();
      await fetch("/api/users/me", { method: "PATCH", body: JSON.stringify({ avatarUrl: url }) });
      await update({ image: url });
      setSavedMsg("Foto actualitzada.");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { name };
    if (newPassword) payload.newPassword = newPassword;
    await fetch("/api/users/me", { method: "PATCH", body: JSON.stringify(payload) });
    await update({ name });
    setNewPassword("");
    setSavedMsg("Perfil desat.");
  }

  return (
    <div className="max-w-md">
      <h2 className="font-display text-2xl mb-0.5">El meu perfil</h2>
      <p className="text-muted text-sm mb-6">Només tu pots veure i canviar això.</p>

      <div className="flex items-center gap-4 mb-6">
        <Avatar user={user ? { id: user.id, name: user.name, color: user.color, avatarUrl: user.image } : null} size={60} />
        <label className="cursor-pointer border border-line rounded px-3 py-2 text-sm text-muted hover:text-ink">
          {uploading ? "Pujant…" : "Canviar foto"}
          <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </label>
      </div>

      <form onSubmit={saveProfile} className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Usuari</label>
          <input value={user?.username || ""} disabled className="w-full border border-line rounded px-3 py-2 text-sm bg-linesoft text-muted" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Nova contrasenya (opcional)</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Deixa-ho buit per no canviar-la"
            className="w-full border border-line rounded px-3 py-2 text-sm bg-white"
          />
        </div>
        {savedMsg && <p className="text-sm text-fet">{savedMsg}</p>}
        <button type="submit" className="bg-ink text-canvas rounded px-5 py-2.5 text-sm">
          Desar canvis
        </button>
      </form>
    </div>
  );
}
