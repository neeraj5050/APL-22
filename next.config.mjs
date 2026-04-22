/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip TypeScript errors during builds (we use JS, not TS)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
