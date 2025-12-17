import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'

// Store active bot sessions and transcripts in memory
const activeBots = new Map<string, any>()
const activeTranscripts = new Map<string, any[]>()

// Directory to save transcripts
const TRANSCRIPTS_DIR = path.join(process.cwd(), 'transcripts')

// Ensure transcripts directory exists
if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true })
}

export async function POST(req: NextRequest) {
  try {
    const { meetLink, userId, userName } = await req.json()

    // Validate meet link
    const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/
    if (!meetRegex.test(meetLink)) {
      return NextResponse.json(
        { error: 'Invalid Google Meet link' },
        { status: 400 }
      )
    }

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Initialize transcript in memory
    activeTranscripts.set(sessionId, [])

    // Create initial session file
    const sessionData = {
      sessionId,
      userId,
      meetLink,
      status: 'active',
      transcript: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to file
    const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2))

    console.log(`Created session file: ${filePath}`)

    // Launch bot in background (don't await)
    launchBot(sessionId, meetLink, userId).catch(error => {
      console.error('Bot error for session', sessionId, ':', error)
      // Update file with error
      const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      sessionData.status = 'error'
      sessionData.errorMessage = error.message
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2))
    })

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      message: 'Bot is joining the meeting'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function launchBot(sessionId: string, meetLink: string, userId: string) {
  console.log(`Launching bot for session ${sessionId}...`)

  // Try to find Chrome executable path
  const executablePath = process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'  // macOS
    : process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'    // Windows
    : '/usr/bin/google-chrome';                                        // Linux

  // Launch browser (prefer Chrome over Chromium)
  const browser = await puppeteer.launch({
    headless: false, // Visible mode for debugging
    executablePath: executablePath, // Use real Chrome instead of Chromium
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream', // Auto-approve camera/mic permissions
      '--use-fake-device-for-media-stream', // Use fake devices
      '--disable-web-security', // Allow cross-origin requests
      '--disable-features=IsolateOrigins,site-per-process', // Prevent frame detachment
      '--disable-blink-features=AutomationControlled', // Hide automation
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    ignoreDefaultArgs: ['--enable-automation'] // Remove automation flag
  })

  const page = await browser.newPage()

  // Store browser instance for cleanup
  activeBots.set(sessionId, { browser, page })

  try {
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 })

    // Navigate to Meet
    console.log(`Navigating to: ${meetLink}`)
    await page.goto(meetLink, { waitUntil: 'networkidle2' })

    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check if meeting is blocked
    const isBlocked = await page.evaluate(() => {
      const text = document.body.innerText || ''
      return text.includes('Não é possível participar') ||
             text.includes('Cannot join') ||
             text.includes('Sua reunião está segura') ||
             text.includes('meeting is secure')
    })

    if (isBlocked) {
      console.log('⚠️ Reunião bloqueada - precisa de convite do organizador')

      // Try to click "Voltar à tela inicial" or "Return to home screen"
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const returnButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || ''
          return text.includes('voltar') || text.includes('return') || text.includes('back')
        })
        if (returnButton) {
          (returnButton as HTMLButtonElement).click()
        }
      })

      // Update session file with blocked status
      const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`)
      const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      sessionData.status = 'blocked'
      sessionData.errorMessage = 'Reunião requer aprovação do organizador'
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2))

      throw new Error('Reunião bloqueada - precisa de aprovação do organizador para entrar')
    }

    // Enter name (look for name input field)
    try {
      // Try different possible selectors for the name input
      const nameSelectors = [
        'input[placeholder*="nome" i]',
        'input[placeholder*="name" i]',
        'input[type="text"]',
        '#c4' // Common ID for Meet name field
      ]

      for (const selector of nameSelectors) {
        const nameInput = await page.$(selector)
        if (nameInput) {
          console.log(`Found name input with selector: ${selector}`)
          await nameInput.type('Assistente Ramppy')
          break
        }
      }
    } catch (e) {
      console.log('Could not find name input, proceeding...')
    }

    // Turn off camera and microphone
    try {
      // Try to click camera button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const cameraButton = buttons.find(btn =>
          btn.getAttribute('aria-label')?.toLowerCase().includes('camera') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('câmera')
        )
        if (cameraButton) {
          console.log('Clicking camera button')
          cameraButton.click()
        }
      })

      // Try to click microphone button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const micButton = buttons.find(btn =>
          btn.getAttribute('aria-label')?.toLowerCase().includes('microphone') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('microfone')
        )
        if (micButton) {
          console.log('Clicking microphone button')
          micButton.click()
        }
      })
    } catch (e) {
      console.log('Could not toggle camera/mic, proceeding...')
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Click join button
    console.log('Looking for join button...')
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const joinButton = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || ''
        const label = btn.getAttribute('aria-label')?.toLowerCase() || ''
        return text.includes('participar') || text.includes('join') ||
               label.includes('participar') || label.includes('join') ||
               text.includes('pedir para participar') || text.includes('ask to join')
      })
      if (joinButton) {
        console.log('Clicking join button')
        (joinButton as HTMLButtonElement).click()
      } else {
        console.log('Join button not found')
      }
    })

    // Wait for meeting to load
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Enable captions - try multiple approaches
    console.log('Enabling captions...')

    // Approach 1: Try keyboard shortcut (C key)
    try {
      await page.keyboard.press('c')
      console.log('Pressed C key to enable captions')
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (e) {
      console.log('Error pressing C key:', e)
    }

    // Approach 2: Try clicking caption button
    try {
      const captionEnabled = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const captionButton = buttons.find(btn => {
          const label = btn.getAttribute('aria-label')?.toLowerCase() || ''
          const text = btn.textContent?.toLowerCase() || ''
          return label.includes('legenda') || label.includes('caption') ||
                 label.includes('ativar legenda') || label.includes('turn on caption') ||
                 label.includes('desativar legenda') || label.includes('turn off caption') ||
                 text.includes('cc')
        })
        if (captionButton) {
          console.log('Found caption button with label:', captionButton.getAttribute('aria-label'))
          ;(captionButton as HTMLButtonElement).click()
          return true
        } else {
          console.log('Caption button not found')
          return false
        }
      })

      if (captionEnabled) {
        console.log('Caption button clicked successfully')
      }
    } catch (e) {
      console.log('Error clicking caption button:', e)
    }

    // Wait for captions to activate
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log(`Bot joined meeting for session ${sessionId}`)

    // Update session file status
    const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`)
    const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    sessionData.status = 'recording'
    sessionData.updatedAt = new Date().toISOString()
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2))

    // Start capturing captions
    let lastTranscript = ''
    let captureAttempts = 0
    const captureInterval = setInterval(async () => {
      try {
        captureAttempts++

        // Look for caption elements
        const result = await page.evaluate(() => {
          // Debug: log all elements that might be captions
          const allDivs = document.querySelectorAll('div')
          const potentialCaptions: string[] = []

          // Try multiple possible selectors for captions
          const selectors = [
            '.a4cQT', // Common caption class
            '.TBMuR', // Another caption class
            '.iTTPOb', // Caption text class
            '[jsname="YPqjbf"]', // Caption container
            '.Mz6pEf', // Speaker name class
            '.zs7s8d', // Another speaker class
            '.iOzk7', // New caption class
            '.VbkSUe', // Another new caption class
            '.U3A9Ac', // Yet another caption class
            '.CNusmb', // Alternative caption container
            '[jsname="tgaKEf"]', // Alternative jsname
            '.Bx7THd', // Text content class
            '.PjTTze', // Speaker indicator
            '.RCaKxc', // Caption line
            '.XvhY1d', // Caption text span
          ]

          const captionData: any[] = []
          let debugInfo = {
            selectorsFound: [] as string[],
            divCount: allDivs.length
          }

          // Check each selector
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector)
            if (elements.length > 0) {
              debugInfo.selectorsFound.push(`${selector} (${elements.length})`)
              elements.forEach((el: any) => {
                const text = el.textContent?.trim()
                if (text && text.length > 0 && !captionData.some((c: any) => c.text === text)) {
                  captionData.push({
                    speaker: 'Speaker',
                    text: text,
                    timestamp: new Date().toISOString(),
                    selector: selector
                  })
                }
              })
            }
          }

          // Alternative approach: look for divs with text that look like captions
          allDivs.forEach(div => {
            const text = div.textContent?.trim() || ''
            // Captions usually have short text (not UI elements)
            if (text.length > 2 && text.length < 200 &&
                !text.includes('Participar') && !text.includes('Join') &&
                !text.includes('Microfone') && !text.includes('Microphone') &&
                !text.includes('Câmera') && !text.includes('Camera')) {
              const style = window.getComputedStyle(div)
              // Captions are usually positioned at bottom
              if (style.position === 'absolute' || style.position === 'fixed') {
                potentialCaptions.push(text)
              }
            }
          })

          return {
            captions: captionData,
            debug: debugInfo,
            potentialCaptions: potentialCaptions.slice(0, 5) // First 5 potential captions
          }
        })

        // Log debug info every 10 attempts
        if (captureAttempts % 10 === 0) {
          console.log('Debug info:', {
            attempt: captureAttempts,
            selectorsFound: result.debug.selectorsFound,
            divCount: result.debug.divCount,
            potentialCaptions: result.potentialCaptions
          })
        }

        if (result.captions.length > 0) {
          // Filter out duplicates
          const newCaptions = result.captions.filter((caption: any) => {
            const captionText = `${caption.speaker}: ${caption.text}`
            if (captionText === lastTranscript) {
              return false
            }
            lastTranscript = captionText
            return true
          })

          if (newCaptions.length > 0) {
            console.log('✅ Captured captions:', newCaptions)

            // Get current transcript from memory
            const currentTranscript = activeTranscripts.get(sessionId) || []
            const updatedTranscript = [...currentTranscript, ...newCaptions]
            activeTranscripts.set(sessionId, updatedTranscript)

            // Save to file
            const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`)
            const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            sessionData.transcript = updatedTranscript
            sessionData.updatedAt = new Date().toISOString()
            fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2))

            console.log(`💾 Saved ${newCaptions.length} new captions to file`)
          }
        } else {
          // Log every 5 attempts when no captions found
          if (captureAttempts % 5 === 0) {
            console.log(`No captions found (attempt ${captureAttempts})`)
            if (result.potentialCaptions.length > 0) {
              console.log('Potential caption texts found:', result.potentialCaptions)
            }
          }
        }
      } catch (error) {
        console.error('Error capturing captions:', error)
      }
    }, 2000) // Capture every 2 seconds

    // Store interval for cleanup
    activeBots.set(sessionId, { browser, page, captureInterval })

  } catch (error) {
    console.error('Bot error:', error)
    // Don't close browser immediately - keep trying to capture
    // await browser.close()
    // activeBots.delete(sessionId)
    // throw error

    // Instead, log the error but keep the bot running
    console.log('Bot encountered an error but will keep trying to capture captions...')
  }
}

// Cleanup function (called when stopping analysis)
export async function stopBot(sessionId: string) {
  const bot = activeBots.get(sessionId)
  if (bot) {
    if (bot.captureInterval) {
      clearInterval(bot.captureInterval)
    }
    if (bot.browser) {
      await bot.browser.close()
    }
    activeBots.delete(sessionId)

    // Update file status
    const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`)
    if (fs.existsSync(filePath)) {
      const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      sessionData.status = 'completed'
      sessionData.endedAt = new Date().toISOString()
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2))
      console.log(`✅ Session ${sessionId} completed. Transcript saved to ${filePath}`)
    }
  }
}