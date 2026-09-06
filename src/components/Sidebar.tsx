"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  IconSun,
  IconLayoutKanban,
  IconMessageCircle,
  IconCalendar,
  IconHeart,
  IconFolder,
  IconUser
} from "@tabler/icons-react";
import Avatar from "./Avatar";

const NAV = [
  { href: "/dashboard", label: "Hoy", icon: IconSun },
  { href: "/dashboard/board", label: "Tablero", icon: IconLayoutKanban },
  { href: "/dashboard/chat", label: "Chat", icon: IconMessageCircle },
  { href: "/dashboard/calendar", label: "Calendario", icon: IconCalendar },
  { href: "/dashboard/kudos", label: "Kudos", icon: IconHeart },
  { href: "/dashboard/personal", label: "Espacio personal", icon: IconFolder },
  { href: "/dashboard/profile", label: "Mi perfil", icon: IconUser }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <aside className="hidden md:flex w-[220px] flex-shrink-0 bg-panel border-r border-border p-5 flex-col h-full overflow-y-auto">
      <p className="font-display font-semibold text-ink text-lg mb-0.5">Tara</p>
      <p className="text-[11px] text-muted mb-6">Panel del equipo</p>

      <nav className="space-y-0.5 -mx-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 border-l-2 ${
                active
                  ? "border-accent bg-surface text-ink font-medium"
                  : "border-transparent text-inksoft hover:bg-surface"
              }`}
            >
              <Icon size={17} stroke={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="border-t border-border pt-3.5 flex items-center gap-2.5">
        <Avatar user={user ? { id: user.id, name: user.name, color: user.color, avatarUrl: user.image } : null} size={30} />
        <div className="min-w-0">
          <div className="text-[13px] text-ink truncate">{user?.name}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[11px] text-muted hover:text-ink"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
