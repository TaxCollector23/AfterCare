import { config } from "../config.js";
import jwt from "jsonwebtoken";
import { AppError } from "../errors.js";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const tokens = new Map<string, string>();

interface DriveState {
  sub: string;
  type: "google_oauth_state";
}

function requireConfigured() {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI) {
    throw new AppError(503, "Google Drive integration is not configured", "DRIVE_NOT_CONFIGURED");
  }
}

export function googleDriveStatus() {
  const configured = Boolean(
    config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI
  );
  return {
    provider: "google_drive",
    configured,
    connectedUsers: tokens.size,
    scope: DRIVE_FILE_SCOPE
  } as const;
}

export function getDriveAuthorization(userId: string) {
  requireConfigured();
  const state = jwt.sign({ type: "google_oauth_state" }, config.GOOGLE_STATE_SECRET, {
    subject: userId,
    expiresIn: "10m"
  });
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: config.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: DRIVE_FILE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state
  });
  return {
    configured: true,
    authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    scope: DRIVE_FILE_SCOPE
  };
}

export async function completeDriveAuthorization(code: string, state: string) {
  requireConfigured();
  let claims: DriveState;
  try {
    claims = jwt.verify(state, config.GOOGLE_STATE_SECRET) as DriveState;
  } catch {
    throw new AppError(400, "Invalid or expired OAuth state", "INVALID_OAUTH_STATE");
  }
  if (claims.type !== "google_oauth_state" || !claims.sub) {
    throw new AppError(400, "Invalid OAuth state", "INVALID_OAUTH_STATE");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      redirect_uri: config.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code"
    })
  });
  const result = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new AppError(502, result.error_description ?? "Google token exchange failed", "DRIVE_OAUTH_FAILED");
  }
  tokens.set(claims.sub, result.access_token);
  return { userId: claims.sub, connected: true };
}

function accessToken(userId: string) {
  const token = tokens.get(userId);
  if (!token) throw new AppError(401, "Connect Google Drive first", "DRIVE_NOT_CONNECTED");
  return token;
}

export async function importDriveFile(userId: string, fileId: string) {
  const token = accessToken(userId);
  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  const metadata = (await metadataResponse.json()) as { name?: string; mimeType?: string; error?: unknown };
  if (!metadataResponse.ok) throw new AppError(502, "Could not read Drive file metadata", "DRIVE_IMPORT_FAILED");
  const contentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (!contentResponse.ok) throw new AppError(502, "Could not download Drive file", "DRIVE_IMPORT_FAILED");
  return {
    name: metadata.name ?? "drive-document.pdf",
    mimeType: metadata.mimeType ?? "application/pdf",
    bytes: Buffer.from(await contentResponse.arrayBuffer())
  };
}

export async function backupDriveFile(userId: string, name: string, bytes: Buffer) {
  const token = accessToken(userId);
  const boundary = `discharge-guide-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name })}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": `multipart/related; boundary=${boundary}`
    },
    body
  });
  const result = (await response.json()) as { id?: string };
  if (!response.ok || !result.id) throw new AppError(502, "Drive backup failed", "DRIVE_BACKUP_FAILED");
  return { fileId: result.id, name };
}

export function resetDriveTokens() {
  tokens.clear();
}
