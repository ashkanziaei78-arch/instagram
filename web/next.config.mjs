/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone: همان خروجی روی هاست ویندوزی با `node server.js` اجرا می‌شود
  output: 'standalone',
  poweredByHeader: false,
  images: { unoptimized: true }
}

export default nextConfig
