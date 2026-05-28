/**
 * One-off backfill: re-process every TrackVersion whose `analysis` is NULL
 * or whose `peaks` array is empty/all-zero. Downloads the audio from Supabase
 * Storage, runs `processAudioBuffer` (same code path as the upload routes),
 * and writes the resulting peaks + analysis back to the DB.
 *
 * Run with:  npx tsx scripts/backfill-audio-processing.ts
 *
 * Reuses the lib at `src/lib/audio-processing.ts` so the script can never
 * drift from the production pipeline.
 */

import 'dotenv/config'
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local', override: true })

import prismaPkg from '@prisma/client'
const { PrismaClient } = prismaPkg as unknown as { PrismaClient: typeof import('@prisma/client').PrismaClient }
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from '@supabase/supabase-js'
// @ts-expect-error -- Node's native ESM resolver needs the explicit .ts here,
// but TS would normally require `allowImportingTsExtensions`. We only run
// this script via `node --experimental-strip-types` or `tsx`, both of which
// understand the extension.
import { processAudioBuffer, serializeAnalysisForDb } from '../src/lib/audio-processing.ts'

const BUCKET = 'tracks'

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : null
}

const databaseUrl = process.env.DATABASE_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!databaseUrl || !supabaseUrl || !serviceKey) {
  console.error('Missing env vars: DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
const all = await prisma.trackVersion.findMany({
  select: {
    id: true,
    audioUrl: true,
    versionNumber: true,
    peaks: true,
    analysis: true,
  },
})

const needsWork = all.filter((v) => {
  const peaksEmpty = v.peaks.length === 0 || v.peaks.every((p) => p === 0)
  const analysisMissing = v.analysis === null
  return peaksEmpty || analysisMissing
})

console.log(`Found ${needsWork.length} versions needing processing (of ${all.length} total).`)

let ok = 0
let failed = 0

for (const v of needsWork) {
  const path = storagePathFromUrl(v.audioUrl)
  if (!path) {
    console.warn(`  • ${v.id} V${v.versionNumber}: could not parse path from ${v.audioUrl}`)
    failed++
    continue
  }
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error || !data) throw error ?? new Error('No data')
    const arr = await data.arrayBuffer()
    const { peaks, analysis } = await processAudioBuffer(new Uint8Array(arr))
    // We only re-process rows that need it, so if analysis failed we leave
    // the existing NULL in place; only peaks get updated.
    await prisma.trackVersion.update({
      where: { id: v.id },
      data: analysis
        ? { peaks, analysis: serializeAnalysisForDb(analysis) as never }
        : { peaks },
    })
    const issueCount = analysis?.issues.length ?? 0
    console.log(
      `  ✓ ${v.id} V${v.versionNumber}: ${peaks.length} peaks, ${issueCount} issue${issueCount === 1 ? '' : 's'}`,
    )
    ok++
  } catch (err) {
    console.error(`  ✗ ${v.id} V${v.versionNumber}: ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

console.log(`\nDone. Success: ${ok}, Failed: ${failed}.`)
await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
