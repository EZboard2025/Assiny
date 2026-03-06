#!/usr/bin/env node
// ============================================================
// Fetch Visual C++ Redistributable x64 for Windows NSIS installer
// Downloads from Microsoft and places in build/ directory
// This runs automatically before build:win
// ============================================================

const https = require('https')
const fs = require('fs')
const path = require('path')

const BUILD_DIR = path.join(__dirname, '..', 'build')
const OUTPUT_FILE = path.join(BUILD_DIR, 'vc_redist.x64.exe')

// Official Microsoft download URL for VC++ 2015-2022 Redistributable x64
const DOWNLOAD_URL = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`[fetch-vcredist] Downloading from ${url}...`)

    const follow = (url) => {
      https.get(url, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`[fetch-vcredist] Redirecting to ${res.headers.location}`)
          follow(res.headers.location)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0
        let downloaded = 0
        const file = fs.createWriteStream(dest)

        res.on('data', (chunk) => {
          downloaded += chunk.length
          if (totalBytes > 0) {
            const pct = ((downloaded / totalBytes) * 100).toFixed(1)
            process.stdout.write(`\r[fetch-vcredist] ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`)
          }
        })

        res.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log('')
          resolve()
        })
        file.on('error', (err) => {
          fs.unlink(dest, () => {})
          reject(err)
        })
      }).on('error', reject)
    }

    follow(url)
  })
}

async function main() {
  // Skip if already downloaded
  if (fs.existsSync(OUTPUT_FILE)) {
    const stats = fs.statSync(OUTPUT_FILE)
    if (stats.size > 1024 * 1024) { // >1MB = valid
      console.log(`[fetch-vcredist] vc_redist.x64.exe already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB) — skipping.`)
      return
    }
  }

  fs.mkdirSync(BUILD_DIR, { recursive: true })

  try {
    await download(DOWNLOAD_URL, OUTPUT_FILE)
    const stats = fs.statSync(OUTPUT_FILE)
    console.log(`[fetch-vcredist] Downloaded to ${OUTPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`)
    console.log('[fetch-vcredist] Done!')
  } catch (err) {
    console.error(`[fetch-vcredist] ERROR: ${err.message}`)
    // Clean up partial download
    if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE)
    process.exit(1)
  }
}

main()
