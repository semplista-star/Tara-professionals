import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { todaysQuote } from "@/lib/motivational-quotes";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const quote = todaysQuote();

  await sendPushToUsers(users.map((u) => u.id), {
    title: "Tara",
    body: quote,
    url: "/dashboard"
  });

  return NextResponse.json({ ok: true, quote });
}
