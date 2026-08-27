/** @type {import('next').NextConfig} */
const nextConfig = {
  // The /portal route reads these files with fs at runtime — make sure Vercel
  // includes them in that function's bundle.
  outputFileTracingIncludes: {
    '/portal': ['./app/portal/portal.html', './app/portal/integration.js'],
  },
};

export default nextConfig;
