import { NextResponse } from 'next/server'

// Função para extrair texto de PDF usando pdf-parse v1
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const result = await pdfParse(buffer)
  return result.text || ''
}

// Função para extrair texto de DOCX usando mammoth
async function extractDocxText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    const fileName = file.name.toLowerCase()
    const extension = fileName.split('.').pop()

    if (!extension || !['pdf', 'docx', 'doc'].includes(extension)) {
      return NextResponse.json(
        { error: 'Formato não suportado. Use PDF ou DOCX.' },
        { status: 400 }
      )
    }

    console.log(`📄 Extraindo conteúdo de: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`)

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let content = ''

    try {
      if (extension === 'pdf') {
        content = await extractPdfText(buffer)
      } else if (extension === 'docx' || extension === 'doc') {
        content = await extractDocxText(buffer)
      }
    } catch (extractError) {
      console.error('❌ Erro na extração:', extractError)
      return NextResponse.json(
        { error: 'Erro ao extrair texto do arquivo. Verifique se o arquivo não está corrompido.' },
        { status: 422 }
      )
    }

    // Limpar o conteúdo
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (content.length < 50) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto suficiente do arquivo. Verifique se o arquivo contém texto (não apenas imagens).' },
        { status: 422 }
      )
    }

    console.log(`✅ Extraído: ${content.length} caracteres`)

    return NextResponse.json({
      success: true,
      content,
      fileName: file.name,
      fileSize: file.size,
      charCount: content.length
    })

  } catch (error) {
    console.error('💥 Erro geral na extração:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar arquivo',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
