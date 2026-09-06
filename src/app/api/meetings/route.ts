import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

const participantSelect = { select: { id: true, name: true, color: true } };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const meetings = await prisma.meeting.findMany({
    include: {
      creator: participantSelect,
      participants: participantSelect
    },
    orderBy: { startsAt: "asc" }
  });
  return NextResponse.json(meetings);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.title || typeof body.title !== "string" || !body.startsAt) {
    return NextResponse.json({ error: "Falta el título o la fecha" }, { status: 400 });
  }
  const participantIds: string[] = Array.isArray(body.participantIds) ? body.participantIds : [];

  const creatorId = (session.user as any).id;
  const meeting = await prisma.meeting.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      location: body.location?.trim() || null,
      startsAt: new Date(body.startsAt),
      durationMinutes: Number(body.durationMinutes) || 30,
      creatorId,
      participants: { connect: participantIds.map((id) => ({ id })) }
    },
    include: {
      creator: participantSelect,
      participants: participantSelect
    }
  });

  const notify = meeting.participants.map((p) => p.id).filter((id) => id !== creatorId);
  sendPushToUsers(notify, {
    title: "Nueva reunión agendada",
    body: `${meeting.title} — ${new Date(meeting.startsAt).toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    })}`,
    url: "/dashboard/calendar"
  }).catch(() => {});

  return NextResponse.json(meeting, { status: 201 });
}
