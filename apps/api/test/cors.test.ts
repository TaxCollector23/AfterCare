import { describe, it, expect, vi } from "vitest";
import {
  corsOriginDelegate,
  isOriginAllowed,
  parseAllowedOrigins,
} from "../src/cors.js";

const PROD = "https://aftercare-web-eta.vercel.app";
const OTHER = "https://marinhacksrtigermygoat.vercel.app";

describe("parseAllowedOrigins", () => {
  it("returns nothing when unconfigured", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
  });

  it("parses a single origin", () => {
    expect(parseAllowedOrigins(PROD).map((r) => r.value)).toEqual([PROD]);
  });

  it("parses a comma-separated list and trims whitespace", () => {
    expect(
      parseAllowedOrigins(` ${PROD} , ${OTHER} `).map((r) => r.value),
    ).toEqual([PROD, OTHER]);
  });

  it("drops empty entries from a trailing comma", () => {
    expect(parseAllowedOrigins(`${PROD},,`).map((r) => r.value)).toEqual([PROD]);
  });

  it("drops a wildcard that isn't a leading host label", () => {
    // Too blunt to be a safe allow-list entry.
    expect(parseAllowedOrigins("https://example.com/*")).toEqual([]);
    expect(parseAllowedOrigins("*")).toEqual([]);
  });
});

describe("isOriginAllowed", () => {
  const rules = parseAllowedOrigins(`${PROD},${OTHER}`);

  it("allows every listed origin", () => {
    expect(isOriginAllowed(PROD, rules)).toBe(true);
    expect(isOriginAllowed(OTHER, rules)).toBe(true);
  });

  it("refuses an origin that isn't listed", () => {
    expect(isOriginAllowed("https://evil.example.com", rules)).toBe(false);
  });

  it("refuses when nothing is configured", () => {
    expect(isOriginAllowed(PROD, [])).toBe(false);
  });

  it("ignores a trailing slash and case", () => {
    expect(isOriginAllowed(`${PROD}/`, rules)).toBe(true);
    expect(isOriginAllowed(PROD.toUpperCase(), rules)).toBe(true);
  });

  it("does not match on scheme mismatch", () => {
    expect(
      isOriginAllowed("http://aftercare-web-eta.vercel.app", rules),
    ).toBe(false);
  });

  describe("wildcard subdomains", () => {
    const wildcard = parseAllowedOrigins("https://*.vercel.app");

    it("matches any single-label subdomain", () => {
      expect(isOriginAllowed(PROD, wildcard)).toBe(true);
      expect(isOriginAllowed(OTHER, wildcard)).toBe(true);
      expect(
        isOriginAllowed("https://aftercare-web-git-abc123.vercel.app", wildcard),
      ).toBe(true);
    });

    it("does not let the wildcard span a dot", () => {
      expect(isOriginAllowed("https://a.b.vercel.app", wildcard)).toBe(false);
    });

    it("does not match a lookalike domain", () => {
      // The classic allow-list bug: an unescaped dot matching any character.
      expect(isOriginAllowed("https://foo.vercelXapp", wildcard)).toBe(false);
      expect(isOriginAllowed("https://vercel.app.evil.com", wildcard)).toBe(
        false,
      );
      expect(isOriginAllowed("https://evil-vercel.app", wildcard)).toBe(false);
    });

    it("does not match the bare domain", () => {
      expect(isOriginAllowed("https://vercel.app", wildcard)).toBe(false);
    });
  });
});

describe("corsOriginDelegate", () => {
  it("allows requests that send no Origin header", () => {
    // Same-origin and server-to-server calls are not governed by CORS.
    const callback = vi.fn();
    corsOriginDelegate(PROD)(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it("allows a listed origin and refuses an unlisted one", () => {
    const delegate = corsOriginDelegate(`${PROD},${OTHER}`);

    const allowed = vi.fn();
    delegate(OTHER, allowed);
    expect(allowed).toHaveBeenCalledWith(null, true);

    const refused = vi.fn();
    delegate("https://evil.example.com", refused);
    expect(refused).toHaveBeenCalledWith(null, false);
  });

  it("refuses a cross-origin request when WEB_ORIGIN is unset", () => {
    const callback = vi.fn();
    corsOriginDelegate(undefined)(PROD, callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });
});
