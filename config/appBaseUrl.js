const DEFAULT_PRODUCTION_URL = "https://upshift-career-ai.onrender.com";

const getAppBaseUrl = () => {
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//i, "")}`
    : "";
  const configuredUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || railwayUrl;
  const baseUrl = configuredUrl || (process.env.NODE_ENV === "production"
    ? DEFAULT_PRODUCTION_URL
    : "http://localhost:8090");

  return baseUrl.trim().replace(/\/+$/, "");
};

module.exports = getAppBaseUrl;
