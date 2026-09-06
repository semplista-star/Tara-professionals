import { prisma } from "@/lib/prisma";

export async function notifyUsers(
  userIds: string[],
  text: string,
  extra?: { taskId?: string; meetingId?: string }
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      text,
      taskId: extra?.taskId,
      meetingId: extra?.meetingId
    }))
  });
}
