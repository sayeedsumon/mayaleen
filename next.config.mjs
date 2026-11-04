/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Payment-proof screenshots are uploaded through a server action (≤ 4 MB each; Vercel caps bodies at 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
