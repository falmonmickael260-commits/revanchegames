const SIZE_CLASSES = {
  sm: "h-8 w-8 text-sm",
  md: "h-16 w-16 text-2xl",
} as const;

function isPhotoUrl(value: string | null | undefined) {
  return !!value && /^https?:\/\//.test(value);
}

/** A player's avatar: an uploaded photo, a chosen emoji, or the first letter of their name. */
export function Avatar({
  username,
  avatarUrl,
  size = "md",
}: {
  username: string;
  avatarUrl: string | null | undefined;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan to-violet font-display font-bold text-void ${SIZE_CLASSES[size]}`}
    >
      {isPhotoUrl(avatarUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl!} alt={username} className="h-full w-full object-cover" />
      ) : avatarUrl ? (
        <span className={size === "sm" ? "text-base" : "text-3xl"}>{avatarUrl}</span>
      ) : (
        <span>{username.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
