import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquetes que no deben empaquetarse y resolverse en runtime mediante
  // el require nativo de Node (decodificación WASM y cliente de Prisma).
  serverExternalPackages: ['audio-decode', '@prisma/client', '.prisma/client'],
  // Permitir que <Image> optimice los assets servidos desde Supabase Storage.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
