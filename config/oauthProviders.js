const getAppBaseUrl = require("./appBaseUrl");

const getProviderConfig = () => {
  const baseUrl = getAppBaseUrl();
  const callbackUrl = (explicitUrl, path) => {
    const configuredUrl = String(explicitUrl || "").trim();
    if (!configuredUrl) return `${baseUrl}${path}`;

    // A copied local .env can leave localhost callback overrides on Render.
    // Rebase only those local URLs in production; keep provider-specific paths.
    if (process.env.NODE_ENV === "production") {
      try {
        const parsedUrl = new URL(configuredUrl);
        if (["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
          return `${baseUrl}${parsedUrl.pathname}`;
        }
      } catch {
        // Preserve non-URL values so configuration errors remain visible to OAuth.
      }
    }

    return configuredUrl.replace(/\/+$/, "");
  };

  return {
    google: {
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && callbackUrl(process.env.GOOGLE_CALLBACK_URL, "/auth/google/callback")),
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackUrl(process.env.GOOGLE_CALLBACK_URL, "/auth/google/callback"),
    },
    github: {
      enabled: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && callbackUrl(process.env.GITHUB_CALLBACK_URL, "/auth/github/callback")),
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: callbackUrl(process.env.GITHUB_CALLBACK_URL, "/auth/github/callback"),
    },
    linkedin: {
      enabled: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && callbackUrl(process.env.LINKEDIN_CALLBACK_URL, "/auth/linkedin/callback")),
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: callbackUrl(process.env.LINKEDIN_CALLBACK_URL, "/auth/linkedin/callback"),
      scope: ["openid", "profile", "email"],
    },
    apple: {
      enabled: Boolean(
        process.env.APPLE_CLIENT_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY_PATH &&
        callbackUrl(process.env.APPLE_CALLBACK_URL, "/auth/apple/callback")
      ),
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
      callbackURL: callbackUrl(process.env.APPLE_CALLBACK_URL, "/auth/apple/callback"),
    },
  };
};

module.exports = getProviderConfig;
