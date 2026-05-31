import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `audio-decode` pulls in WASM decoders and `@eshaz/web-worker`, which uses
  // a dynamic `import(<runtime-string>)` that Turbopack can't statically
  // resolve. We only ever invoke it server-side (from `/api/tracks/*` route
  // handlers) so loading it through Node's native `require` is fine.
  serverExternalPackages: ['audio-decode'],
  // Whitelist the Supabase Storage public origin so <Image> can optimise
  // user-uploaded covers and avatars (resize, format negotiation, lazy
  // loading) instead of shipping the original-size file every time.
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
