/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "*.videodelivery.net" },
      { protocol: "https", hostname: "*.cloudflarestream.com" },
    ],
  },
  // The admin "Control Room" is served at /admin/* (pages physically live in
  // /manage/*). The real /admin/login page still wins (afterFiles rewrite).
  async rewrites() {
    return [{ source: "/admin/:path*", destination: "/manage/:path*" }];
  },
  // Old /manage/* links now live at /admin/*.
  async redirects() {
    return [{ source: "/manage/:path*", destination: "/admin/:path*", permanent: false }];
  },
};

export default nextConfig;
