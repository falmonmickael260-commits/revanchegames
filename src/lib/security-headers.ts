/** Global response headers for the platform, not for independently hosted games.
 * Keep microphone, fullscreen, gamepad, clipboard, web-share and payment
 * capabilities available: the game iframe and vocal flows depend on them.
 */
export function securityHeaders(production: boolean) {
  const enforced = [
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  // Observe a stricter policy before blocking scripts, game frames or live
  // services. Next.js inline hydration and external integrations need testing.
  // No reporting endpoint: violations are visible locally in browser devtools.
  const reportOnly = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: enforced },
    { key: "Content-Security-Policy-Report-Only", value: reportOnly },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "geolocation=(), usb=(), serial=(), hid=(), bluetooth=(), midi=()" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}
