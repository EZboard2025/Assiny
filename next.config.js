/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Pacotes que NÃO devem ser bundlados pelo webpack (usam require dinâmico)
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Aumentar limite de tamanho de body para uploads (100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
}

module.exports = nextConfig