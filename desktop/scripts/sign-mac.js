// Post-pack hook: properly ad-hoc sign the macOS app bundle
// electron-builder's default signing skips when no Developer ID is found,
// leaving a broken linker-signed signature that macOS flags as "damaged"
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function (context) {
  // Windows: patch exe with correct icon and metadata (since signAndEditExecutable is disabled)
  if (context.electronPlatformName === 'win32') {
    const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
    const rceditPath = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')
    console.log(`[patch-win] Patching ${exePath} with icon and metadata`)
    try {
      execSync(`"${rceditPath}" "${exePath}" --set-icon "${iconPath}" --set-version-string ProductName "Ramppy" --set-version-string FileDescription "Ramppy" --set-version-string CompanyName "Ramppy" --set-version-string InternalName "ramppy" --set-version-string OriginalFilename "Ramppy.exe"`, { stdio: 'inherit' })
      console.log('[patch-win] Icon and metadata patched successfully')
    } catch (err) {
      console.error('[patch-win] Failed:', err.message)
    }
    return
  }

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
