"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false
    });

    setLoading(false);
    if (res?.error) {
      setError("Correu o contrasenya incorrectes.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl mb-1">Tara</h1>
        <p className="text-muted text-sm mb-8">Entra amb el teu compte de l'equip.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Correu</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 bg-white text-sm"
              placeholder="tu@tara-project.com"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Contrasenya</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 bg-white text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-canvas rounded py-2.5 text-sm disabled:opacity-60"
          >
            {loading ? "Entrant…" : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-muted mt-6">
          Els comptes els crea qui administri el projecte (script de seed). Parla amb ell/a si no tens accés.
        </p>
      </div>
    </div>
  );
}
