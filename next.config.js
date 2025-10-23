/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async redirects() {
    return [
      {
        source: '/', // Rota de origem (a raiz do site)
        destination: '/login', // Rota de destino (a página de login)
        permanent: true, // Define se o redirecionamento é permanente (melhor para SEO)
      },
    ]
  },
};

module.exports = nextConfig;
