/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  swcMinify: true,

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  images: {
    domains: [
      "localhost",
      // Add your S3/MinIO domains here
    ],
  },

  experimental: {
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "lucide-react",
    ],
    serverComponentsExternalPackages: [
      "@prisma/client",
    ],
  },

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Optimize for development
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    // Handle SVG imports
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Bundle analyzer support
  ...(process.env.ANALYZE === "true" && {
    experimental: {
      ...config.experimental,
    },
  }),
};

export default config;