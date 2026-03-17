/**
 * Token-based Auth Middleware for NextChat
 * 
 * 支持两种认证方式：
 * 1. URL Token: ?token=xxx (首次访问使用)
 * 2. Cookie Token: auth_token=xxx (后续访问自动携带)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 从环境变量读取访问密码，默认值仅用于测试
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "qoder2026"

export function middleware(request: NextRequest) {
  // 如果是 API 请求，跳过鉴权让 API route 自己处理
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // 如果是静态资源，跳过鉴权
  if (
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/serviceWorkerRegister.js') ||
    request.nextUrl.pathname.endsWith('.ico') ||
    request.nextUrl.pathname.endsWith('.png') ||
    request.nextUrl.pathname.endsWith('.svg')
  ) {
    return NextResponse.next()
  }
  
  // 如果是登录/清理页面，跳过鉴权（允许直接访问）
  if (
    request.nextUrl.pathname.startsWith('/auth/login') ||
    request.nextUrl.pathname.startsWith('/auth/cleanup-token')
  ) {
    return NextResponse.next()
  }
  
  // 检查 URL 中的 token 参数
  const urlToken = request.nextUrl.searchParams.get('token')
  
  // 检查 Cookie 中的 token
  const cookieToken = request.cookies.get('auth_token')?.value
  
  // 如果都没有，重定向到登录页面
  if (!urlToken && !cookieToken) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // 验证 URL Token（首次访问）
  if (urlToken) {
    if (urlToken !== ACCESS_TOKEN) {
      // Token 无效，显示错误页面
      return new NextResponse('Invalid access token', {
        status: 401,
      })
    }
    
    // Token 有效，设置 Cookie 并重定向到清理页面
    // 清理页面会去掉 URL 中的 token 参数，然后跳转到首页
    const response = NextResponse.redirect(new URL('/auth/cleanup-token', request.url))
    response.cookies.set({
      name: 'auth_token',
      value: urlToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })
    return response
  }
  
  // 验证 Cookie Token（后续访问）
  if (cookieToken !== ACCESS_TOKEN) {
    // Cookie 无效，清除并重定向到登录页
    const response = NextResponse.redirect(new URL('/auth/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }
  
  // 验证通过，继续处理请求
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
