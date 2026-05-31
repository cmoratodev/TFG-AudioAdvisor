/**
 * One-off image processing pipeline for the default per-genre covers.
 *
 *   1. Crop the bottom ~10% of each image to strip Gemini's bottom-left
 *      watermark (we sacrifice a sliver of artwork at the bottom — the
 *      compositions still read fine).
 *   2. Crop the sides equally so the result stays square (1:1) instead of
 *      ending up slightly letterboxed.
 *   3. Convert to .webp at high quality — ~10× smaller than the source PNG
 *      with no perceptible loss for cover art.
 *   4. Save under the slug expected by `coverForTrack()` (e.g.
 *      `acustico.webp`, `hip-hop.webp`) and leave the originals in place so
 *      we can re-run if the crop ratio needs tweaking.
 *
 * Run with:  npx tsx scripts/process-genre-covers.mts
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..', 'public', 'genres')

/**
 * Fraction of the original height to lop off the bottom. Gemini's watermark
 * sits in the bottom-left at roughly 6–8 % depending on the resolution;
 * 10 % gives a comfortable margin without eating into the main composition.
 */
const WATERMARK_CROP_PCT = 0.1

/** WebP quality. 88 is the sweet spot for photography-style imagery — 92+ is
 *  diminishing returns, 80 starts showing block artefacts in soft gradients. */
const WEBP_QUALITY = 88

const MAP: Record<string, string> = {
  'genero-Acustico.png': 'acustico.webp',
  'genero-Electronica.png': 'electronica.webp',
  'genero-HipHop.png': 'hip-hop.webp',
  'genero-Jazz.png': 'jazz.webp',
  'genero-Otro.png': 'otro.webp',
  'genero-Pop.png': 'pop.webp',
  'genero-Rock.png': 'rock.webp',
}

async function processOne(srcName: string, dstName: string) {
  const srcPath = path.join(ROOT, srcName)
  const dstPath = path.join(ROOT, dstName)
  const image = sharp(srcPath)
  const metadata = await image.metadata()
  const { width, height } = metadata
  if (!width || !height) {
    throw new Error(`${srcName}: no metadata, skipping`)
  }

  // Step 1: strip the watermark band.
  const cropHeight = Math.round(height * (1 - WATERMARK_CROP_PCT))

  // Step 2: re-square. After cropping the bottom we have a `width × cropHeight`
  // rectangle (slightly wider than tall). Pull equal margins off the sides so
  // the final image is square.
  const finalSize = Math.min(width, cropHeight)
  const xOffset = Math.round((width - finalSize) / 2)
  const yOffset = Math.round((cropHeight - finalSize) / 2)

  await image
    .extract({ left: xOffset, top: yOffset, width: finalSize, height: finalSize })
    .webp({ quality: WEBP_QUALITY })
    .toFile(dstPath)

  const srcSize = (await fs.stat(srcPath)).size
  const dstSize = (await fs.stat(dstPath)).size
  const reduction = Math.round((1 - dstSize / srcSize) * 100)
  console.log(
    `  ✓ ${srcName} → ${dstName}  ${formatBytes(srcSize)} → ${formatBytes(dstSize)}  (-${reduction}%)`,
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function main() {
  console.log(`Processing ${Object.keys(MAP).length} genre covers in ${ROOT}\n`)
  let ok = 0
  let failed = 0
  for (const [src, dst] of Object.entries(MAP)) {
    try {
      await processOne(src, dst)
      ok++
    } catch (err) {
      console.error(`  ✗ ${src}: ${err instanceof Error ? err.message : err}`)
      failed++
    }
  }
  console.log(`\nDone. Success: ${ok}, Failed: ${failed}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
