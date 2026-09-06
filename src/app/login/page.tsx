"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username: username.trim().toLowerCase(),
      password,
      redirect: false
    });

    setLoading(false);
    if (res?.error) {
      setError("Usuario o contraseña incorrectos.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-panel border border-border rounded-xl p-8">
        <h1 className="font-display text-3xl mb-1">Tara</h1>
        <p className="text-muted mb-8">Entra con tu cuenta del equipo.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Usuario</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent"
              placeholder="marky"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-canvas focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white rounded-lg py-2.5 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-muted mt-6">
          Las cuentas las crea quien administra el proyecto (script de seed). Habla con esa persona si no tienes acceso.
        </p>
      </div>
    </div>
  );
}
