import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, user, supabaseResponse } = await updateSession(request)
  const path = request.nextUrl.pathname

  const isAuthPath = path === '/login' || path === '/register' || path === '/forgot-password'
  
  // Jika sudah login tapi mengakses halaman auth
  if (isAuthPath && user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    const role = profile?.role || 'customer'
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }

  // Proteksi rute berdasarkan role
  const isProtectedRoute = path.startsWith('/customer') || path.startsWith('/cashier') || path.startsWith('/admin')
  
  if (isProtectedRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: profile } = await supabase.from('profiles').select('id, role, status_karyawan, status').eq('user_id', user.id).single()
    const role = profile?.role
    const statusKaryawan = profile?.status_karyawan
    const status = profile?.status

    if (statusKaryawan && statusKaryawan !== 'aktif') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL(`/login?suspended=${statusKaryawan}&pid=${profile?.id || ''}`, request.url))
    }

    if (status && status !== 'active') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL(`/login?suspended=${status}&pid=${profile?.id || ''}`, request.url))
    }

    if (path.startsWith('/customer') && role !== 'customer') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if (path.startsWith('/cashier') && role !== 'cashier') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
