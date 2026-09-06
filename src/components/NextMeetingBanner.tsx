"use client";

import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { MeetingT } from "@/types";

function relativeLabel(startsAt: string) {
  const diffMs = new Date(startsAt).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const date = new Date(startsAt);
  const time = date.toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit" });

  if (diffMin <= 0) return `ara mateix, ${time}`;
  if (diffMin < 60) return `en ${diffMin} min, ${time}`;

  const isToday = date.toDateString() === new Date().toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return `avui a les ${time}`;
  if (isTomorrow) return `demà a les ${time}`;
  return `${date.toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "short" })} a les ${time}`;
}

export default function NextMeetingBanner() {
  const [meeting, setMeeting] = useState<MeetingT | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/meetings/next");
      if (!res.ok) return;
      const data = await res.json();
      setMeeting(data);
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!meeting || meeting.id === dismissed) return null;

  const startsAt = new Date(meeting.startsAt).getTime();
  const endsAt = startsAt + meeting.durationMinutes * 60000;
  const hoursUntil = (startsAt - Date.now()) / 3600000;
  if (Date.now() > endsAt || hoursUntil > 24) return null;

  const soon = startsAt - Date.now() < 10 * 60000;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#EFE9D8] border-b border-line text-sm">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${soon ? "bg-danger animate-pulse" : "bg-[#8A6A1F]"}`} />
      <span className="text-muted flex-shrink-0 hidden sm:inline">📅 Pròxima reunió:</span>
      <span className="font-medium truncate">{meeting.title}</span>
      <span className="text-muted flex-shrink-0">{relativeLabel(meeting.startsAt)}</span>
      {meeting.location && (
        <span className="text-muted truncate hidden md:inline">· {meeting.location}</span>
      )}
      <div className="flex -space-x-1.5 ml-auto flex-shrink-0">
        {meeting.participants.slice(0, 5).map((p) => (
          <Avatar key={p.id} user={p} size={22} />
        ))}
      </div>
      <button onClick={() => setDismissed(meeting.id)} className="text-muted hover:text-ink flex-shrink-0 ml-1">
        ✕
      </button>
    </div>
  );
}
