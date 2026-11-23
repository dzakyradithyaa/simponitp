/** @type {import('next').NextConfig} */
const API = process.env.API_INTERNAL_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { proxyTimeout: 300_000 }, // large GeoTIFF uploads
  async rewrites() {
    // The browser only talks to this origin; cookies stay first-party.
    return {
      fallback: [{ source: "/api/:path*", destination: `${API}/api/:path*` }],
    };
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

export default nextConfig;
