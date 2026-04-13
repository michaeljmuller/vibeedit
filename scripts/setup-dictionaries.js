#!/usr/bin/env node
// Copies dictionary data files from macOS system locations into data/.
// Run once after cloning: node scripts/setup-dictionaries.js

import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_BASE = '/System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX'

const DICTIONARIES = [
  {
    name: 'Portuguese - English',
    bundleName: 'Portuguese - English.dictionary',
    destDir: 'portuguese-english-dictionary',
    files: ['Body.data'],
    instructions: [
      'Open the Dictionary app (Applications > Dictionary)',
      'Go to Dictionary > Settings (⌘,)',
      'Check "Portuguese - English" to download it',
      'Wait for the download to complete, then re-run this script',
    ],
  },
  {
    name: 'Italian - English',
    bundleName: 'Italian - English.dictionary',
    destDir: 'italian-english-dictionary',
    files: ['Body.data'],
    instructions: [
      'Open the Dictionary app (Applications > Dictionary)',
      'Go to Dictionary > Settings (⌘,)',
      'Check "Oxford Paravia Italian Dictionary" to download it',
      'Wait for the download to complete, then re-run this script',
    ],
  },
]

function findBundle(bundleName) {
  try {
    for (const dir of readdirSync(ASSET_BASE)) {
      const p = join(ASSET_BASE, dir, 'AssetData', bundleName, 'Contents', 'Resources')
      if (existsSync(p)) return p
    }
  } catch {}
  return null
}

let allOk = true

for (const dict of DICTIONARIES) {
  const dest = join(ROOT, 'data', dict.destDir)
  const alreadyDone = dict.files.every(f => existsSync(join(dest, f)))

  if (alreadyDone) {
    console.log(`✓ ${dict.name} — already present`)
    continue
  }

  const src = findBundle(dict.bundleName)
  if (!src) {
    console.error(`✗ ${dict.name} — not found on this system`)
    console.error(`\n  To install it:`)
    dict.instructions.forEach((line, i) => console.error(`  ${i + 1}. ${line}`))
    console.error()
    allOk = false
    continue
  }

  mkdirSync(dest, { recursive: true })
  for (const file of dict.files) {
    copyFileSync(join(src, file), join(dest, file))
    console.log(`✓ ${dict.name} — copied ${file}`)
  }
}

if (!allOk) process.exit(1)
