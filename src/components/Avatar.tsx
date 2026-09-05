import { UserLite } from "@/types";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Avatar({ user, size = 32 }: { user: UserLite | null | undefined; size?: number }) {
  if (!user) {
    return (
      <div
        className="rounded-full bg-line flex items-center justify-center text-muted flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        ?
      </div>
    );
  }

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-display flex-shrink-0"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }}
    >
      {initials(user.name)}
    </div>
  );
}
