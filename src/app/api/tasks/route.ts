import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { notifyUsers } from "@/lib/notify";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Falta el título" }, { status: 400 });
  }

  // Cualquier miembro puede crear una tarea y asignarla a otro miembro
  // directamente, sin entrar en el perfil de nadie.
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
      title: "Nueva tarea asignada",
      body: `${task.creator.name} te ha asignado: ${task.title}`,
      url: "/dashboard/board"
    }).catch(() => {});
    notifyUsers([task.assigneeId], `${task.creator.name} te ha asignado: ${task.title}`, { taskId: task.id }).catch(() => {});
  }

  return NextResponse.json(task, { status: 201 });
}
