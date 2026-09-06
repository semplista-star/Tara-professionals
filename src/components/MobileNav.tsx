"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Hoy", icon: "☀️" },
  { href: "/dashboard/board", label: "Tablero", icon: "📋" },
  { href: "/dashboard/chat", label: "Chat", icon: "💬" },
  { href: "/dashboard/calendar", label: "Agenda", icon: "📅" },
  { href: "/dashboard/kudos", label: "Kudos", icon: "🌱" },
  { href: "/dashboard/personal", label: "Personal", icon: "🗂" },
  { href: "/dashboard/profile", label: "Perfil", icon: "👤" }
];

export function MobileTopBar() {
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-2 bg-sidebar text-white flex-shrink-0">
      <span className="font-display font-semibold text-base">Tara</span>
      <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-[#CFD6CE]">
        Salir
      </button>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-[#2C362F] flex z-30">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] ${
              active ? "text-white" : "text-[#8B9389]"
            }`}
          >
            <span className="text-sm leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
