// Post-pack hook: properly ad-hoc sign the macOS app bundle
// electron-builder's default signing skips when no Developer ID is found,
// leaving a broken linker-signed signature that macOS flags as "damaged"
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function (context) {
  // Only run on macOS builds
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  console.log(`[sign-mac] Signing ${appPath}`)

  try {
    // Sign the entire bundle (--deep signs all nested code)
    execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' })
    console.log('[sign-mac] Ad-hoc signing complete')

    // Verify
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' })
    console.log('[sign-mac] Signature verification passed')
  } catch (err) {
    console.error('[sign-mac] Signing failed:', err.message)
    // Don't fail the build — unsigned app still works locally
  }
}
