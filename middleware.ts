import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // Detectar ambiente
  const isLocalhost = hostname.includes('localhost') || hostname.includes('ramppy.local')

  // Extrair subdomínio
  let subdomain = ''
  if (isLocalhost) {
    // localhost: assiny.ramppy.local:3000 -> "assiny"
    const parts = hostname.split('.')
    if (parts.length >= 3 && parts[1] === 'ramppy') {
      subdomain = parts[0]
    }
  } else {
    // produção: assiny.ramppy.site -> "assiny"
    const parts = hostname.split('.')
    if (parts.length >= 3 && parts[1] === 'ramppy') {
      subdomain = parts[0]
    }
  }

  // Se não tem subdomínio (domínio principal), redirecionar para seleção de empresa
  const isMainDomain = !subdomain || subdomain === 'www' || subdomain === 'ramppy'
  const isSelectCompanyPage = request.nextUrl.pathname === '/select-company'

  if (isMainDomain && !isSelectCompanyPage) {
    // Domínio principal sem subdomínio -> redirecionar para seleção
    const url = request.nextUrl.clone()
    url.pathname = '/select-company'
    return NextResponse.redirect(url)
  }

  // Se tem subdomínio, adicionar header para usar no app
  if (subdomain && subdomain !== 'www' && subdomain !== 'ramppy') {
    const response = NextResponse.next()
    response.headers.set('x-subdomain', subdomain)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
}
