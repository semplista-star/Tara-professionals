import { UserLite } from "@/types";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function OnlineDot({ size }: { size: number }) {
  const dot = Math.max(7, Math.round(size * 0.28));
  return (
    <span
      className="absolute rounded-full bg-fet border-2 border-canvas"
      style={{ width: dot, height: dot, right: -1, bottom: -1 }}
    />
  );
}

export default function Avatar({
  user,
  size = 32,
  online
}: {
  user: UserLite | null | undefined;
  size?: number;
  online?: boolean;
}) {
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

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-display"
          style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }}
        >
          {initials(user.name)}
        </div>
      )}
      {online && <OnlineDot size={size} />}
    </div>
  );
}
