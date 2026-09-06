import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, any> = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.priority === "string") data.priority = body.priority;
  if ("assigneeId" in body) data.assigneeId = body.assigneeId || null;
  if ("dueDate" in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const before = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true } });

  const task = await prisma.task.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, name: true, color: true } },
      creator: { select: { id: true, name: true, color: true } },
      comments: { include: { author: { select: { id: true, name: true, color: true } } } }
    }
  });

  const myId = (session.user as any).id;
  if (task.assigneeId && task.assigneeId !== before?.assigneeId && task.assigneeId !== myId) {
    sendPushToUsers([task.assigneeId], {
      title: "Nova tasca assignada",
      body: `Se t'ha assignat: ${task.title}`,
      url: "/dashboard"
    }).catch(() => {});
  }

  return NextResponse.json(task);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
