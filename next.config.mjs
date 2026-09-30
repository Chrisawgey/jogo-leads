/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['firebase-admin'],
  transpilePackages: ['react-leaflet', '@react-leaflet/core'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // Private team tool: keep it out of search engines and other sites' frames
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
