// ============================================================
// Ramppy Audio Device Manager
// Manages BlackHole virtual audio driver for seamless system audio capture
// Creates/destroys Multi-Output devices so user still hears audio
// ============================================================

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const BLACKHOLE_HAL_PATH = '/Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver'
const BLACKHOLE_DEVICE_NAME = 'BlackHole 2ch'

let audioDevices = null
let multiOutputDeviceId = null
let originalDefaultOutputId = null

// Lazy-load macos-audio-devices (only available on macOS)
function getAudioDevices() {
  if (!audioDevices) {
    try {
      audioDevices = require('macos-audio-devices')
    } catch (err) {
      console.error('[AudioDevices] Failed to load macos-audio-devices:', err.message)
      return null
    }
  }
  return audioDevices
}

/**
 * Check if BlackHole driver is installed in the system HAL directory
 */
function isBlackHoleInstalled() {
  return fs.existsSync(BLACKHOLE_HAL_PATH)
}

/**
 * Find the BlackHole device in CoreAudio device list
 * Returns the device object or null
 */
function detectBlackHoleDevice() {
  const ad = getAudioDevices()
  if (!ad) return null

  try {
    const allDevices = ad.getAllDevices.sync()
    return allDevices.find(d => d.name && d.name.includes(BLACKHOLE_DEVICE_NAME)) || null
  } catch (err) {
    console.error('[AudioDevices] Failed to enumerate devices:', err.message)
    return null
  }
}

/**
 * Install BlackHole driver from app bundle to system HAL directory
 * Requires admin privileges — triggers macOS native password dialog
 * @param {string} resourcesPath - path to app's Resources directory (process.resourcesPath)
 * @returns {boolean} success
 */
function installBlackHoleDriver(resourcesPath) {
  const driverSource = path.join(resourcesPath, 'drivers', 'BlackHole2ch.driver')

  if (!fs.existsSync(driverSource)) {
    console.error('[AudioDevices] Driver bundle not found at:', driverSource)
    return false
  }

  if (isBlackHoleInstalled()) {
    console.log('[AudioDevices] BlackHole already installed, skipping.')
    return true
  }

  try {
    // Use osascript to trigger native macOS admin password dialog
    // Paths must use escaped quotes (\") inside the AppleScript string
    const escapedSource = driverSource.replace(/"/g, '\\"')
    const escapedDest = BLACKHOLE_HAL_PATH.replace(/"/g, '\\"')

    const escapedDestDir = path.dirname(BLACKHOLE_HAL_PATH).replace(/"/g, '\\"')
    const cmd = [
      `mkdir -p \\"${escapedDestDir}\\"`,
      `cp -R \\"${escapedSource}\\" \\"${escapedDest}\\"`,
      `chown -R root:wheel \\"${escapedDest}\\"`,
      `chmod -R 755 \\"${escapedDest}\\"`,
      `killall -9 coreaudiod`,
    ].join(' && ')

    console.log('[AudioDevices] Running install command via osascript...')
    execSync(`osascript -e 'do shell script "${cmd}" with administrator privileges'`, {
      timeout: 30000,
    })

    console.log('[AudioDevices] BlackHole driver installed successfully.')
    return true
  } catch (err) {
    // User cancelled the password dialog or installation failed
    console.error('[AudioDevices] Driver installation failed:', err.message)
    return false
  }
}

/**
 * Create a Multi-Output device that routes audio to both the real speakers AND BlackHole.
 * This ensures the user still hears audio while BlackHole captures it.
 * Sets the Multi-Output as the default system output.
 * @returns {{ success: boolean, deviceName?: string, error?: string }}
 */
function createMultiOutputDevice() {
  const ad = getAudioDevices()
  if (!ad) return { success: false, error: 'macos-audio-devices not available' }

  try {
    // 1. Always destroy any existing Ramppy Audio devices first (clean slate)
    try {
      const allDevices = ad.getAllDevices.sync()
      const existing = allDevices.filter(d => d.name === 'Ramppy Audio')
      for (const d of existing) {
        try {
          ad.destroyAggregateDevice.sync(d.id)
          console.log(`[AudioDevices] Cleaned up existing Ramppy Audio ID: ${d.id}`)
        } catch (_) {}
      }
    } catch (_) {}
    multiOutputDeviceId = null

    // 2. Find BlackHole device
    const blackhole = detectBlackHoleDevice()
    if (!blackhole) {
      return { success: false, error: 'BlackHole device not found in CoreAudio' }
    }

    // 3. Get the CURRENT default output (could be speakers, AirPods, HDMI, etc.)
    const currentDefault = ad.getDefaultOutputDevice.sync()
    console.log(`[AudioDevices] Current default output: "${currentDefault.name}" (ID: ${currentDefault.id})`)

    // If current default is already BlackHole or Ramppy, find the real device
    let realOutput
    if (currentDefault.name.includes('BlackHole') || currentDefault.name.includes('Ramppy')) {
      const outputDevices = ad.getOutputDevices.sync()
      realOutput = outputDevices.find(d =>
        !d.name.includes('BlackHole') &&
        !d.name.includes('Ramppy') &&
        !d.name.includes('Multi-Output')
      )
    } else {
      realOutput = currentDefault
    }

    if (!realOutput) {
      return { success: false, error: 'No real output device found' }
    }

    // Save real output ID to restore later
    originalDefaultOutputId = realOutput.id

    console.log(`[AudioDevices] Creating Multi-Output: "${realOutput.name}" (${realOutput.id}) + BlackHole (${blackhole.id})`)

    // 4. Create multi-output device: main=real output, secondary=BlackHole
    ad.createAggregateDevice.sync(
      'Ramppy Audio',
      realOutput.id,
      [blackhole.id],
      { multiOutput: true }
    )

    // 5. The returned ID from createAggregateDevice is unreliable (known bug).
    //    Find the real device by name instead.
    const devicesAfter = ad.getAllDevices.sync()
    const realAggregate = devicesAfter.find(d => d.name === 'Ramppy Audio' && d.isOutput)

    if (!realAggregate) {
      return { success: false, error: 'Aggregate device not found after creation' }
    }

    multiOutputDeviceId = realAggregate.id
    console.log(`[AudioDevices] Aggregate created: real ID ${realAggregate.id}`)

    // 6. Set as default so all system audio routes through it
    ad.setDefaultOutputDevice.sync(realAggregate.id)

    const newDefault = ad.getDefaultOutputDevice.sync()
    console.log(`[AudioDevices] Multi-Output active: "${newDefault.name}" (ID: ${newDefault.id}) → ${realOutput.name} + BlackHole`)

    return { success: true, deviceName: 'Ramppy Audio' }
  } catch (err) {
    console.error('[AudioDevices] Failed to create Multi-Output device:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Destroy the Multi-Output device and restore the original default output.
 * Safe to call even if no Multi-Output exists.
 * @returns {{ success: boolean, error?: string }}
 */
function destroyMultiOutputDevice() {
  const ad = getAudioDevices()
  if (!ad) return { success: false, error: 'macos-audio-devices not available' }

  try {
    // Restore original default output first
    if (originalDefaultOutputId) {
      try {
        ad.setDefaultOutputDevice.sync(originalDefaultOutputId)
        console.log(`[AudioDevices] Restored default output to device ID: ${originalDefaultOutputId}`)
      } catch (restoreErr) {
        console.warn('[AudioDevices] Could not restore original output:', restoreErr.message)
      }
    }

    // Destroy ALL Ramppy Audio aggregate devices (covers orphans too)
    const allDevices = ad.getAllDevices.sync()
    const ramppyDevices = allDevices.filter(d => d.name === 'Ramppy Audio')
    for (const d of ramppyDevices) {
      try {
        ad.destroyAggregateDevice.sync(d.id)
        console.log(`[AudioDevices] Destroyed Ramppy Audio device ID: ${d.id}`)
      } catch (_) {}
    }

    multiOutputDeviceId = null
    originalDefaultOutputId = null
    return { success: true }
  } catch (err) {
    console.error('[AudioDevices] Failed to destroy Multi-Output device:', err.message)
    multiOutputDeviceId = null
    originalDefaultOutputId = null
    return { success: false, error: err.message }
  }
}

module.exports = {
  isBlackHoleInstalled,
  detectBlackHoleDevice,
  installBlackHoleDriver,
  createMultiOutputDevice,
  destroyMultiOutputDevice,
}
