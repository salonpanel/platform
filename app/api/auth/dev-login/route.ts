import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/auth/dev-login
 * Auto-login en desarrollo (SOLO DESARROLLO)
 * 
 * ⚠️ SEGURIDAD CRÍTICA:
 * - Este endpoint NO debe estar activo en producción
 * - Solo funciona si NODE_ENV === 'development'
 * - Solo permite un email específico configurado
 * 
 * NO SE DEPLOYA EN PRODUCCIÓN
 */
export async function POST(req: Request) {
  // Verificación estricta: solo desarrollo
  const isDevelopment = process.env.NODE_ENV === "development";
  const devLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  // Triple verificación para máxima seguridad:
  // 1. NODE_ENV debe ser development
  // 2. Flag explícita NEXT_PUBLIC_ENABLE_DEV_LOGIN debe ser "true"
  // 3. No debe estar en producción
  if (!isDevelopment || process.env.NODE_ENV === "production" || !devLoginEnabled) {
    console.error("⚠️ Intento de acceso a dev-login bloqueado (no disponible en producción)");
    return NextResponse.json(
      { error: "Este endpoint solo está disponible en desarrollo" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { email } = body;

    // Email permitido para auto-login en desarrollo
    const DEV_EMAIL = "u0136986872@gmail.com";

    if (email.toLowerCase() !== DEV_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { error: "Email no permitido para auto-login" },
        { status: 403 }
      );
    }

    // Usar service_role para crear sesión directamente
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no configurado" },
        { status: 500 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Buscar el usuario existente primero
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Error al listar usuarios:", listError);
      return NextResponse.json(
        { error: `Error al buscar usuarios: ${listError.message}` },
        { status: 500 }
      );
    }

    let user = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Si el usuario no existe, crearlo directamente
    if (!user) {
      try {
        console.log("Usuario no existe, creando...");

        // Crear usuario con email confirmado
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: email.toLowerCase(),
            email_confirm: true, // Confirmar email automáticamente
            user_metadata: {
              name: email.split("@")[0],
            },
          });

        // Incluso si hay error, el usuario puede haberse creado (el trigger puede fallar pero el usuario se crea)
        if (createError) {
          console.warn("Error al crear usuario (puede ser del trigger):", createError.message);

          // Esperar un momento para que el usuario se cree (aunque el trigger falle)
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Buscar el usuario de nuevo
          const { data: retryUsers, error: retryError } = await supabaseAdmin.auth.admin.listUsers();
          if (!retryError && retryUsers) {
            user = retryUsers.users?.find(
              (u) => u.email?.toLowerCase() === email.toLowerCase()
            );
          }

          // Si aún no existe después de esperar, el trigger está bloqueando la creación
          // En este caso, el usuario puede haberse creado parcialmente en auth.users
          // pero el trigger falló. Vamos a verificar directamente en la base de datos
          if (!user) {
            console.log("Usuario no encontrado después del error, verificando en base de datos directamente...");

            // Intentar buscar el usuario usando RPC o consulta directa
            try {
              // Usar una función RPC para crear el usuario directamente, evitando el trigger
              // O simplemente intentar crear de nuevo después de más tiempo
              await new Promise(resolve => setTimeout(resolve, 3000));

              const { data: finalRetry } = await supabaseAdmin.auth.admin.listUsers();
              user = finalRetry?.users?.find(
                (u) => u.email?.toLowerCase() === email.toLowerCase()
              );

              if (!user) {
                // Si aún no existe, el trigger está bloqueando completamente
                // En este caso, necesitamos deshabilitar el trigger temporalmente o crear el usuario manualmente
                console.error("El trigger está bloqueando la creación del usuario. El usuario necesita ser creado manualmente o el trigger necesita ser corregido.");
              }
            } catch (altErr: any) {
              console.error("Excepción al verificar usuario:", altErr);
            }
          }
        } else if (newUser?.user) {
          user = newUser.user;
          console.log("Usuario creado exitosamente");
        }

        // Si después de todo no tenemos usuario, devolver error
        if (!user) {
          return NextResponse.json(
            {
              error: "No se pudo crear el usuario. Verifica los logs del servidor.",
              message: "Intenta usar el flujo normal de magic link."
            },
            { status: 500 }
          );
        }
      } catch (err: any) {
        console.error("Excepción al crear usuario:", err);

        // Último intento: buscar el usuario
        const { data: lastRetry } = await supabaseAdmin.auth.admin.listUsers();
        user = lastRetry?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (!user) {
          return NextResponse.json(
            {
              error: "Error inesperado al crear usuario",
              message: err?.message || "Error desconocido"
            },
            { status: 500 }
          );
        }
      }
    } else {
      console.log("Usuario ya existe, usando usuario existente");
    }

    // Confirmar email si no está confirmado
    if (user && !user.email_confirmed_at) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
      } catch (err: any) {
        console.warn("Error al confirmar email (no crítico):", err);
      }
    }

    // Generar un magic link que redirigirá a nuestro handler del lado del cliente
    // Usar URL centralizada para callbacks de auth
    const { URLS } = await import("@/lib/urls");
    const redirectUrl = `${URLS.PRO_BASE}/auth/magic-link-handler`;
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase(),
        options: {
          redirectTo: redirectUrl,
        },
      });

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: `Error al generar link: ${linkError?.message}` },
        { status: 500 }
      );
    }

    // Extraer el código del magic link
    const magicLinkUrl = new URL(linkData.properties.action_link);
    const code = magicLinkUrl.searchParams.get("code");

    if (!code) {
      // Si no hay código, devolver el magic link para que el cliente lo use directamente
      return NextResponse.json({
        success: true,
        magicLink: linkData.properties.action_link,
        message: "Usa este link para iniciar sesión automáticamente",
      });
    }

    // Crear sesión usando el cliente normal con el código
    // Crear sesión usando el cliente normal con el código
    // En Next.js 15+, cookies() es manejado dentro de createClientForServer
    const supabaseClient = await createClientForServer();

    // Intercambiar código por sesión
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.exchangeCodeForSession(code);

    if (sessionError || !sessionData.session) {
      // Si falla, devolver el magic link para que el cliente lo use
      return NextResponse.json({
        success: true,
        magicLink: linkData.properties.action_link,
        message: "Usa este link para iniciar sesión automáticamente",
        error: sessionError?.message,
      });
    }

    // Sesión creada exitosamente
    return NextResponse.json({
      success: true,
      user: sessionData.user,
      session: sessionData.session,
    });
  } catch (err: any) {
    console.error("Error en dev-login:", err);
    console.error("Stack trace:", err?.stack);
    return NextResponse.json(
      {
        error: err?.message || "Error inesperado",
        details: process.env.NODE_ENV === "development" ? err?.stack : undefined
      },
      { status: 500 }
    );
  }
}

