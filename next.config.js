/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Aumentar limite de tamanho de body para uploads de PDF (100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Configuração para API routes com uploads grandes
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
    responseLimit: false,
  },
}

module.exports = nextConfig