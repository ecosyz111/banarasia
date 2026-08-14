import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      // The public site is a single static page under public/sample-caterer/.
      // Serve it at the site root as well as at the legacy /sample-caterer path
      // the source repo used. This array form is an `afterFiles` rewrite, so it
      // is only consulted once static files and pages have missed — there is no
      // app/page.tsx, so "/" lands here.
      {
        source: "/",
        destination: "/sample-caterer/index.html",
      },
      {
        source: "/sample-caterer",
        destination: "/sample-caterer/index.html",
      },
    ];
  },
};

export default nextConfig;
