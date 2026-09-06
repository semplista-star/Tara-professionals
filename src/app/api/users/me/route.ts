import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, any> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.avatarUrl === "string") data.avatarUrl = body.avatarUrl;

  if (typeof body.newPassword === "string" && body.newPassword.length >= 6) {
    data.passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id: (session.user as any).id },
    data,
    select: { id: true, name: true, username: true, avatarUrl: true, color: true }
  });

  return NextResponse.json(updated);
}
