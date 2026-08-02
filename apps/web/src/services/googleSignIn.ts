/**
 * "Sign in with Google" for the browser.
 *
 * Two paths, because the two backing services authenticate differently:
 *
 *   backend  — Google Identity Services hands us an ID token, which the API
 *              verifies at POST /auth/google and exchanges for a session.
 *   firebase — Firebase's own Google provider, via a popup.
 *
 * Both are optional. When the client id (or Firebase) isn't configured, the
 * button is simply not offered and email/password remains available, rather
 * than showing a control that fails when pressed.
 */

import { currentMode, isFirebaseConfigured } from "./config";

const GSI_SRC = "https://accounts.google.com/gsi/client";

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

/** Whether Google sign-in can work in the current mode. */
export function isGoogleSignInAvailable(): boolean {
  const mode = currentMode();
  if (mode === "backend") return Boolean(googleClientId);
  if (mode === "firebase") return isFirebaseConfigured;
  return false; // local mode has no accounts at all
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, string | number>,
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads Google's script once per page, resolving when the API is usable. */
function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      // Reset so a later attempt can retry rather than hanging on a rejected
      // promise for the rest of the session.
      scriptPromise = null;
      reject(new Error("Couldn't reach Google to sign you in."));
    });
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

/**
 * Renders Google's own branded button into `container`.
 *
 * Google requires their button rather than a look-alike, and it is the element
 * that produces the ID token, so this can't be a plain styled button.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  onCredential: (idToken: string) => void,
  options: { dark?: boolean; width?: number } = {},
): Promise<void> {
  if (!googleClientId) throw new Error("Google sign-in isn't configured.");
  await loadGsiScript();
  const api = window.google?.accounts?.id;
  if (!api) throw new Error("Couldn't reach Google to sign you in.");

  api.initialize({
    client_id: googleClientId,
    callback: (response) => {
      if (response.credential) onCredential(response.credential);
    },
  });
  container.replaceChildren();
  api.renderButton(container, {
    type: "standard",
    theme: options.dark ? "filled_black" : "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: options.width ?? 320,
  });
}

/** Firebase's Google popup. Returns once the user is signed in. */
export async function signInWithGooglePopup(): Promise<void> {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const { auth } = await import("../firebase");
  await signInWithPopup(auth, new GoogleAuthProvider());
}
