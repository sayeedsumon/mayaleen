/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Payment-proof screenshots are uploaded through a server action (≤ 5 MB each).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
