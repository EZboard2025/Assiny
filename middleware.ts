import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request: NextRequest) {
  // SISTEMA UNIFICADO: Verificar se está ativado
  const USE_UNIFIED_SYSTEM = process.env.NEXT_PUBLIC_USE_UNIFIED_SYSTEM === 'true'

  if (USE_UNIFIED_SYSTEM) {
    // Sistema unificado - não faz nada com subdomínios
    // Todo o controle de empresa é feito pelo company_id do usuário logado
    return NextResponse.next()
  }

  // SISTEMA LEGADO: Código original para compatibilidade
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

  // Se tem subdomínio, verificar se empresa está bloqueada
  if (subdomain && subdomain !== 'www' && subdomain !== 'ramppy') {
    // Verificar se a empresa está bloqueada (exceto na página /locked)
    if (!request.nextUrl.pathname.startsWith('/locked')) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: company } = await supabase
          .from('companies')
          .select('locked')
          .eq('subdomain', subdomain)
          .single()

        // Se empresa está bloqueada, redirecionar para página de bloqueio
        if (company?.locked === true) {
          return NextResponse.redirect(new URL('/locked', request.url))
        }
      } catch (error) {
        console.error('Error checking company lock status:', error)
        // Em caso de erro, permitir acesso (fail-open para não bloquear por problemas técnicos)
      }
    }

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
