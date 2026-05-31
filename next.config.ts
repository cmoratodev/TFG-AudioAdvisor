import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Packages we explicitly DO NOT want bundled by Turbopack — they either
  // pull in dynamic requires the bundler can't resolve, or split
  // themselves across sub-packages that the trace misses.
  //
  //  - `audio-decode`: WASM decoders + `@eshaz/web-worker` with a dynamic
  //    `import(<runtime-string>)` Turbopack can't statically resolve.
  //  - `@prisma/client` + `.prisma/client`: Prisma 7 split runtime helpers
  //    into a separate `@prisma/client-runtime-utils` package which the
  //    bundler doesn't trace, breaking the deployed function with
  //    "Cannot find module '@prisma/client-runtime-utils'" on Vercel.
  //    Treating Prisma as external lets Node's normal require chain find
  //    everything at runtime.
  serverExternalPackages: ['audio-decode', '@prisma/client', '.prisma/client'],
  // Belt and braces for Vercel: explicitly include the Prisma runtime files
  // in the function bundle. Without this Vercel only ships what Next's
  // tracer pulled in, and Prisma-as-external means the tracer skipped them.
  outputFileTracingIncludes: {
    '/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
      './node_modules/@prisma/client-runtime-utils/**/*',
    ],
  },
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
