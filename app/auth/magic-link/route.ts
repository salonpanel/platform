import { NextResponse } from "next/server";

/**
 * Esta ruta redirige al cliente a una página que maneja el magic link
 * El magic link de Supabase viene con tokens en el hash, que solo el cliente puede leer
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  
  // Redirigir a una página del cliente que maneje el hash
  const redirectUrl = new URL("/auth/magic-link-handler", url.origin);
  
  // Pasar el hash completo si existe
  if (url.hash) {
    redirectUrl.hash = url.hash;
  }
  
  // También pasar query params
  url.searchParams.forEach((value, key) => {
    redirectUrl.searchParams.set(key, value);
  });
  
  return NextResponse.redirect(redirectUrl);
}








