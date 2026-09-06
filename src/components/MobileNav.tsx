"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconSun,
  IconLayoutKanban,
  IconMessageCircle,
  IconCalendar,
  IconHeart,
  IconFolder,
  IconUser
} from "@tabler/icons-react";

const NAV = [
  { href: "/dashboard", label: "Hoy", icon: IconSun },
  { href: "/dashboard/board", label: "Tablero", icon: IconLayoutKanban },
  { href: "/dashboard/chat", label: "Chat", icon: IconMessageCircle },
  { href: "/dashboard/calendar", label: "Agenda", icon: IconCalendar },
  { href: "/dashboard/kudos", label: "Kudos", icon: IconHeart },
  { href: "/dashboard/personal", label: "Personal", icon: IconFolder },
  { href: "/dashboard/profile", label: "Perfil", icon: IconUser }
];

export function MobileTopBar() {
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-2 bg-panel border-b border-border text-ink flex-shrink-0">
      <span className="font-display font-semibold text-base">Tara</span>
      <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-muted">
        Salir
      </button>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-panel border-t border-border flex z-30">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] ${
              active ? "text-accent" : "text-muted"
            }`}
          >
            <Icon size={18} stroke={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
