/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        // a câmera (leitura de boleto) só pode ser usada pelas páginas do próprio app, nunca por conteúdo embutido de outro site
        headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' }],
      },
    ];
  },
};

export default nextConfig;
