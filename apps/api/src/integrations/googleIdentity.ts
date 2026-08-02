/**
 * "Sign in with Google" ID token verification.
 *
 * This is an authentication boundary, so nothing here is hand-rolled: the
 * signature check, Google's key rotation, and the issuer/audience/expiry
 * assertions all go through google-auth-library. A decoded-but-unverified JWT
 * is attacker-controlled input — anyone can mint one — so the payload is only
 * trusted after `verifyIdToken` succeeds.
 *
 * Separate from integrations/googleDrive.ts on purpose: that flow authorises
 * access to a user's Drive files, this one establishes who the user is.
 */
import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { AppError } from "../errors.js";

export interface GoogleIdentity {
  /** Google's stable user id (`sub`). Never reused across accounts. */
  googleId: string;
  email: string;
  emailVerified: boolean;
}

/** True when the server has what it needs to accept Google sign-ins. */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(config.GOOGLE_CLIENT_ID);
}

let client: OAuth2Client | null = null;
function oauthClient(): OAuth2Client {
  // Cached so the library can reuse its fetched signing keys between requests.
  client ??= new OAuth2Client(config.GOOGLE_CLIENT_ID);
  return client;
}

/** Test seam: lets the route be exercised without reaching Google. */
export type IdTokenVerifier = (idToken: string) => Promise<GoogleIdentity>;

export const verifyGoogleIdToken: IdTokenVerifier = async (idToken) => {
  if (!isGoogleSignInConfigured()) {
    throw new AppError(
      503,
      "Google sign-in isn't configured on this server.",
      "GOOGLE_SIGN_IN_UNAVAILABLE",
    );
  }

  let payload;
  try {
    const ticket = await oauthClient().verifyIdToken({
      idToken,
      // Pinning the audience is what stops a token minted for a different
      // Google app from being replayed against this one.
      audience: config.GOOGLE_CLIENT_ID!,
    });
    payload = ticket.getPayload();
  } catch {
    // Deliberately opaque: the caller learns the token was rejected, not why.
    throw new AppError(401, "Google sign-in failed.", "INVALID_GOOGLE_TOKEN");
  }

  if (!payload?.sub || !payload.email) {
    throw new AppError(401, "Google sign-in failed.", "INVALID_GOOGLE_TOKEN");
  }

  // An unverified Google address proves nothing about who controls that
  // mailbox, and accepting it would let someone claim an email that belongs to
  // an existing password account.
  if (payload.email_verified !== true) {
    throw new AppError(
      403,
      "Your Google email address isn't verified. Verify it with Google and try again.",
      "GOOGLE_EMAIL_UNVERIFIED",
    );
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
  };
};
