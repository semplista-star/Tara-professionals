import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "Comentario vacío" }, { status: 400 });
  }

  const myId = (session.user as any).id;
  const comment = await prisma.comment.create({
    data: {
      text: body.text.trim(),
      taskId: id,
      authorId: myId
    },
    include: {
      author: { select: { id: true, name: true, color: true } },
      task: { select: { title: true, assigneeId: true, creatorId: true } }
    }
  });

  const notify = [comment.task.assigneeId, comment.task.creatorId].filter(
    (uid): uid is string => !!uid && uid !== myId
  );
  sendPushToUsers([...new Set(notify)], {
    title: "Nuevo comentario",
    body: `${comment.author.name} ha comentado en "${comment.task.title}"`,
    url: "/dashboard"
  }).catch(() => {});

  return NextResponse.json(comment, { status: 201 });
}
