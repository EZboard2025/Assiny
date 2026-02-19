import { NextResponse } from 'next/server'

export const maxDuration = 30

// Extract text from PDF buffer using pdf-parse
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const result = await pdfParse(buffer)
  return result.text || ''
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await req.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let text = ''

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(buffer)
      } else {
        // Try as plain text
        text = buffer.toString('utf-8')
      }

      if (!text.trim()) {
        return NextResponse.json(
          { error: 'Nao foi possivel extrair texto do arquivo. Verifique se o PDF contem texto (nao apenas imagens).' },
          { status: 422 }
        )
      }

      // Limit to 20000 chars
      text = text.substring(0, 20000).trim()

      return NextResponse.json({
        text,
        source: file.name,
        type: 'file'
      })

    } else {
      // URL extraction
      const { url } = await req.json()

      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'URL e obrigatoria' }, { status: 400 })
      }

      let normalizedUrl = url.trim()
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = 'https://' + normalizedUrl
      }

      // Validate URL
      try {
        const parsed = new URL(normalizedUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json({ error: 'URL invalida' }, { status: 400 })
        }
        const hostname = parsed.hostname.toLowerCase()
        if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
          return NextResponse.json({ error: 'URL invalida' }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: 'URL invalida' }, { status: 400 })
      }

      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Nao foi possivel acessar o site. Verifique a URL e tente novamente.' },
          { status: 422 }
        )
      }

      const html = await response.text()

      // Extract text from HTML
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()

      if (!text || text.length < 50) {
        return NextResponse.json(
          { error: 'Site com pouco conteudo textual. Tente outra pagina.' },
          { status: 422 }
        )
      }

      text = text.substring(0, 20000)

      return NextResponse.json({
        text,
        source: normalizedUrl,
        type: 'url'
      })
    }
  } catch (error) {
    console.error('Erro extract-text:', error)
    return NextResponse.json(
      { error: 'Erro ao extrair texto', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 }
    )
  }
}
