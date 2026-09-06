import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:tara-professionals@example.com", vapidPublicKey, vapidPrivateKey);
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey || userIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } }
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        // Suscripción caducada o revocada: la borramos para que no vuelva a fallar.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}
