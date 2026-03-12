/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Pacotes que NÃO devem ser bundlados pelo webpack (usam require dinâmico)
  serverExternalPackages: ['pdf-parse', 'mammoth', 'googleapis'],
  // Aumentar limite de tamanho de body para uploads (100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Aumentar limite de body para API routes (upload de áudio/vídeo)
  serverRuntimeConfig: {
    bodySizeLimit: '100mb',
  },
}

module.exports = nextConfig