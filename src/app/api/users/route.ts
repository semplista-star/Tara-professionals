import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, avatarUrl: true, color: true }
  });
  return NextResponse.json(users);
}
