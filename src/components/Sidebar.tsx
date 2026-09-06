"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Avatar from "./Avatar";

const NAV = [
  { href: "/dashboard", label: "Tablero" },
  { href: "/dashboard/chat", label: "Chat" },
  { href: "/dashboard/calendar", label: "Calendario" },
  { href: "/dashboard/kudos", label: "Kudos" },
  { href: "/dashboard/personal", label: "Espacio personal" },
  { href: "/dashboard/profile", label: "Mi perfil" }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <aside className="hidden md:flex w-[210px] flex-shrink-0 bg-sidebar text-[#CFD6CE] p-5 flex-col h-full overflow-y-auto">
      <p className="font-display font-semibold text-white text-lg mb-0.5">Tara</p>
      <p className="text-[11px] text-[#8B9389] mb-6">Panel del equipo</p>

      <nav className="space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-2.5 py-2 rounded text-[13.5px] transition-colors ${
              pathname === item.href ? "bg-[#2C362F] text-white" : "hover:bg-[#2C362F]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="border-t border-[#2C362F] pt-3.5 flex items-center gap-2.5">
        <Avatar user={user ? { id: user.id, name: user.name, color: user.color, avatarUrl: user.image } : null} size={30} />
        <div className="min-w-0">
          <div className="text-[13px] text-white truncate">{user?.name}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[11px] text-[#8B9389] hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
