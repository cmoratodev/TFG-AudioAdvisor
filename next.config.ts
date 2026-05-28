import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `audio-decode` pulls in WASM decoders and `@eshaz/web-worker`, which uses
  // a dynamic `import(<runtime-string>)` that Turbopack can't statically
  // resolve. We only ever invoke it server-side (from `/api/tracks/*` route
  // handlers) so loading it through Node's native `require` is fine.
  serverExternalPackages: ['audio-decode'],
};

export default nextConfig;
