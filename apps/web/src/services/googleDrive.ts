/**
 * Google Drive connector.
 *
 * Uses Google Identity Services (OAuth token client) + the Google Picker API so a
 * patient can pick a discharge-summary PDF straight out of their own Drive instead
 * of downloading and re-uploading it.
 *
 * Requires VITE_GOOGLE_DRIVE_CLIENT_ID and VITE_GOOGLE_DRIVE_API_KEY (see .env.example).
 * Until those are set, isGoogleDriveConfigured is false and callers should hide/disable
 * the "Connect Google Drive" button rather than call into this module.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export const isGoogleDriveConfigured = Boolean(CLIENT_ID && API_KEY);

export class GoogleDriveNotConfiguredError extends Error {
  constructor() {
    super(
      "The Google Drive connector isn't set up yet. Add VITE_GOOGLE_DRIVE_CLIENT_ID and VITE_GOOGLE_DRIVE_API_KEY to apps/web/.env.local."
    );
    this.name = "GoogleDriveNotConfiguredError";
  }
}

export interface DrivePickedFile {
  id: string;
  name: string;
  mimeType: string;
  /** Short-lived OAuth access token, needed to fetch bytes for the picked file if you download it. */
  accessToken: string;
}

let scriptsLoadingPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

async function ensureGoogleScripts(): Promise<void> {
  if (!scriptsLoadingPromise) {
    scriptsLoadingPromise = Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js"),
    ]).then(() => void 0);
  }
  return scriptsLoadingPromise;
}

function loadPickerLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gapi = (window as any).gapi;
    if (!gapi) {
      reject(new Error("Google API script did not load."));
      return;
    }
    gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Failed to load Picker.")) });
  });
}

function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services did not load."));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error("Google sign-in was cancelled or denied."));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

/** Opens the account picker + Drive file picker, resolving with the chosen PDF (or null if cancelled). */
export async function pickFileFromGoogleDrive(): Promise<DrivePickedFile | null> {
  if (!isGoogleDriveConfigured) throw new GoogleDriveNotConfiguredError();

  await ensureGoogleScripts();
  await loadPickerLibrary();
  const accessToken = await requestAccessToken();

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    const view = new g.picker.DocsView(g.picker.ViewId.PDFS).setIncludeFolders(true).setSelectFolderEnabled(false);

    const picker = new g.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setCallback((data: any) => {
        if (data.action === g.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType, accessToken });
        } else if (data.action === g.picker.Action.CANCEL) {
          resolve(null);
        } else if (data.action === g.picker.Action.ERROR) {
          reject(new Error("Google Drive picker failed to open."));
        }
      })
      .build();
    picker.setVisible(true);
  });
}

/** Downloads the picked file's bytes directly from Drive using the short-lived access token. */
export async function fetchDriveFileBlob(file: DrivePickedFile): Promise<Blob> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${file.accessToken}` },
  });
  if (!res.ok) throw new Error("Couldn't download that file from Google Drive. Please try again.");
  return res.blob();
}
