import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

export async function POST(req: NextRequest) {
  try {
    const { meetLink } = await req.json()

    console.log('Starting caption test...')

    // Launch browser in visible mode
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })

    console.log('Navigating to:', meetLink)
    await page.goto(meetLink, { waitUntil: 'networkidle2' })

    // Give user time to manually join the meeting and enable captions
    console.log('Waiting 10 seconds for manual setup...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Now try to find captions
    const captionInfo = await page.evaluate(() => {
      // Get all elements and their text
      const elements: any[] = []

      // Check all divs
      document.querySelectorAll('div').forEach(div => {
        const text = div.textContent?.trim() || ''
        if (text.length > 0 && text.length < 200) {
          const styles = window.getComputedStyle(div)
          elements.push({
            text: text.substring(0, 100),
            className: div.className,
            position: styles.position,
            bottom: styles.bottom,
            zIndex: styles.zIndex,
            fontSize: styles.fontSize,
            color: styles.color,
            background: styles.backgroundColor
          })
        }
      })

      // Also check spans
      document.querySelectorAll('span').forEach(span => {
        const text = span.textContent?.trim() || ''
        if (text.length > 0 && text.length < 200) {
          const styles = window.getComputedStyle(span)
          if (styles.position === 'absolute' || styles.position === 'fixed' ||
              span.className.toLowerCase().includes('caption') ||
              span.className.toLowerCase().includes('subtitle')) {
            elements.push({
              text: text.substring(0, 100),
              className: span.className,
              tagName: 'span',
              position: styles.position,
              fontSize: styles.fontSize
            })
          }
        }
      })

      return {
        totalDivs: document.querySelectorAll('div').length,
        totalSpans: document.querySelectorAll('span').length,
        potentialCaptions: elements.slice(0, 20),
        // Try known selectors
        knownSelectors: {
          '.a4cQT': document.querySelectorAll('.a4cQT').length,
          '.TBMuR': document.querySelectorAll('.TBMuR').length,
          '.iTTPOb': document.querySelectorAll('.iTTPOb').length,
          '.iOzk7': document.querySelectorAll('.iOzk7').length,
          '.VbkSUe': document.querySelectorAll('.VbkSUe').length,
          '[role="region"][aria-live="polite"]': document.querySelectorAll('[role="region"][aria-live="polite"]').length,
          '[aria-live="polite"]': document.querySelectorAll('[aria-live="polite"]').length,
        }
      }
    })

    console.log('Caption detection results:', JSON.stringify(captionInfo, null, 2))

    // Keep browser open for 30 seconds to observe
    console.log('Keeping browser open for 30 seconds...')
    await new Promise(resolve => setTimeout(resolve, 30000))

    await browser.close()

    return NextResponse.json({
      success: true,
      captionInfo
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}