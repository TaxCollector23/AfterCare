/**
 * Allowed browser origins.
 *
 * `WEB_ORIGIN` was a single URL, which meant exactly one deployment could ever
 * talk to the API cross-origin — a second Vercel project (or any preview
 * deployment) was refused with no useful error, because a blocked preflight
 * just looks like "the site is broken".
 *
 * It now accepts a comma-separated list, and entries may use a `*` wildcard in
 * the leftmost host label so Vercel's generated preview subdomains can be
 * allowed as a group. The wildcard never spans a dot, so
 * `https://*.vercel.app` matches `https://foo.vercel.app` but not
 * `https://foo.evil.com` or `https://a.b.vercel.app`.
 */

export interface OriginRule {
  /** The literal origin, or a pattern with a `*` in the host's first label. */
  value: string;
  matches: (origin: string) => boolean;
}

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

function buildRule(entry: string): OriginRule | null {
  const value = normalize(entry);
  if (!value) return null;

  if (!value.includes("*")) {
    return { value, matches: (origin) => normalize(origin) === value };
  }

  // Only a leading `*.` wildcard is supported; anything else is too blunt to
  // be safe as an allow-list entry.
  const match = value.match(/^(https?:\/\/)\*\.(.+)$/);
  if (!match) return null;
  const [, scheme, domain] = match;
  const pattern = new RegExp(
    `^${scheme}[a-z0-9-]+\\.${domain!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
  );
  return { value, matches: (origin) => pattern.test(normalize(origin)) };
}

/** Parses the configured value into match rules, dropping unusable entries. */
export function parseAllowedOrigins(
  configured: string | undefined,
): OriginRule[] {
  if (!configured) return [];
  return configured
    .split(",")
    .map(buildRule)
    .filter((rule): rule is OriginRule => rule !== null);
}

/** True when the browser's Origin header is on the allow-list. */
export function isOriginAllowed(
  origin: string | undefined,
  rules: OriginRule[],
): boolean {
  if (!origin) return false;
  return rules.some((rule) => rule.matches(origin));
}

/**
 * The `origin` option for the cors middleware.
 *
 * Same-origin and server-to-server requests send no Origin header at all; those
 * are allowed through, exactly as they were before this list existed — CORS
 * only governs cross-origin browser requests.
 */
export function corsOriginDelegate(configured: string | undefined) {
  const rules = parseAllowedOrigins(configured);
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, isOriginAllowed(origin, rules));
  };
}
