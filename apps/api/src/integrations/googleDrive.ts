import { config } from "../config.js";

export function googleDriveStatus() {
  const configured = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  return {
    provider: "google_drive",
    configured: configured && !config.MOCK_INTEGRATIONS,
    mode: config.MOCK_INTEGRATIONS ? "mock" : "live",
    scope: "https://www.googleapis.com/auth/drive.file"
  } as const;
}

export function getDriveAuthorization() {
  if (config.MOCK_INTEGRATIONS || !config.GOOGLE_CLIENT_ID) {
    return {
      configured: false,
      authorizationUrl: null,
      scope: "https://www.googleapis.com/auth/drive.file",
      message: "Google Drive is in placeholder mode. Add OAuth credentials to enable it."
    };
  }

  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: "http://localhost:3001/drive/callback",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline"
  });
  return {
    configured: true,
    authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    scope: "https://www.googleapis.com/auth/drive.file"
  };
}
