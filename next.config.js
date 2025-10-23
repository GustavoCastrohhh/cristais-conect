/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Removido anteriormente
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Remova ou comente a função redirects inteira:
  // async redirects() {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/login',
  //       permanent: true, // Ou false, dependendo da intenção original
  //     },
  //   ]
  // },
};

module.exports = nextConfig;
