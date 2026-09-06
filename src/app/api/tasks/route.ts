import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const tasks = await prisma.task.findMany({
    include: {
      assignee: { select: { id: true, name: true, color: true } },
      creator: { select: { id: true, name: true, color: true } },
      comments: {
        include: { author: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const body = await req.json();
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Falta el títol" }, { status: 400 });
  }

  // Qualsevol membre pot crear una tasca i assignar-la a un altre membre
  // directament, sense entrar al perfil de ningú.
  const task = await prisma.task.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      status: body.status || "PENDENT",
      priority: body.priority || "MITJA",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assigneeId: body.assigneeId || null,
      creatorId: (session.user as any).id
    },
    include: {
      assignee: { select: { id: true, name: true, color: true } },
      creator: { select: { id: true, name: true, color: true } },
      comments: true
    }
  });

  if (task.assigneeId && task.assigneeId !== task.creatorId) {
    sendPushToUsers([task.assigneeId], {
      title: "Nova tasca assignada",
      body: `${task.creator.name} t'ha assignat: ${task.title}`,
      url: "/dashboard"
    }).catch(() => {});
  }

  return NextResponse.json(task, { status: 201 });
}
