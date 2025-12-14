import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { createClientForServer } from "@/lib/supabase/server-client";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCY = process.env.STRIPE_DEFAULT_CURRENCY ?? "eur";

type SyncServiceRequest = {
  service_id: string;
  tenant_id: string;
};

type SyncAllRequest = {
  tenant_id: string;
};

/**
 * POST /api/payments/services/sync
 * Sincroniza un servicio con Stripe (crea/actualiza producto y precio)
 * 
 * Body:
 * - service_id: UUID del servicio (requerido para sincronización individual)
 * - tenant_id: UUID del tenant (requerido)
 * 
 * Response:
 * - service_id: UUID del servicio
 * - product_id: ID del producto en Stripe
 * - price_id: ID del precio en Stripe
 * - synced: true si se sincronizó correctamente
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SyncServiceRequest | SyncAllRequest;

    // P1.3: Validar autenticación
    const supabaseAuth = await createClientForServer();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const supabase = supabaseServer();

    // P1.3: Validar permisos sobre el tenant (owner/admin)
    const tenantId = "service_id" in body ? (body as SyncServiceRequest).tenant_id : (body as SyncAllRequest).tenant_id;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene acceso al tenant y es owner/admin
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar este tenant. Se requiere rol owner o admin." },
        { status: 403 }
      );
    }

    if ("service_id" in body) {
      // Sincronizar un servicio específico
      const { service_id, tenant_id } = body as SyncServiceRequest;

      if (!service_id || !tenant_id) {
        return NextResponse.json(
          { error: "service_id y tenant_id son requeridos" },
          { status: 400 }
        );
      }

      // Obtener servicio
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("id, tenant_id, name, price_cents, duration_min, active, stripe_product_id, stripe_price_id")
        .eq("id", service_id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (serviceError || !service) {
        return NextResponse.json(
          { error: "Servicio no encontrado" },
          { status: 404 }
        );
      }

      if (!service.active) {
        return NextResponse.json(
          { error: "Servicio inactivo. Activa el servicio antes de sincronizar." },
          { status: 400 }
        );
      }

      // Sincronizar con Stripe
      let productId = service.stripe_product_id;
      let priceId = service.stripe_price_id;

      try {
        // Crear o actualizar producto en Stripe
        if (!productId) {
          const product = await stripe.products.create({
            name: service.name,
            active: service.active,
            metadata: {
              tenant_id: tenant_id,
              service_id: service.id,
            },
          });
          productId = product.id;
        } else {
          // Actualizar producto existente
          await stripe.products.update(productId, {
            name: service.name,
            active: service.active,
            metadata: {
              tenant_id: tenant_id,
              service_id: service.id,
            },
          });
        }

        // Crear nuevo precio si el precio actual no coincide o no existe
        // Nota: Stripe no permite actualizar precios, solo crear nuevos
        let needsNewPrice = false;
        if (!priceId) {
          needsNewPrice = true;
        } else {
          // Verificar si el precio actual coincide con el precio del servicio
          try {
            const existingPrice = await stripe.prices.retrieve(priceId);
            if (existingPrice.unit_amount !== service.price_cents) {
              needsNewPrice = true;
            }
          } catch (error) {
            // Precio no encontrado en Stripe, crear nuevo
            needsNewPrice = true;
          }
        }

        if (needsNewPrice) {
          // Desactivar precio anterior si existe
          if (priceId) {
            try {
              await stripe.prices.update(priceId, {
                active: false,
              });
            } catch (error) {
              // Ignorar errores al desactivar precio anterior
            }
          }

          // Crear nuevo precio
          const newPrice = await stripe.prices.create({
            product: productId,
            currency: CURRENCY,
            unit_amount: service.price_cents,
            metadata: {
              tenant_id: tenant_id,
              service_id: service.id,
            },
          });
          priceId = newPrice.id;
        }

        // Actualizar servicio en la base de datos
        const { error: updateError } = await supabase
          .from("services")
          .update({
            stripe_product_id: productId,
            stripe_price_id: priceId,
          })
          .eq("id", service_id);

        if (updateError) {
          return NextResponse.json(
            { error: `Error al actualizar servicio: ${updateError.message}` },
            { status: 500 }
          );
        }

        // P1.3: Auditar cambio
        await supabase.rpc("create_log", {
          p_tenant_id: tenant_id,
          p_user_id: userId,
          p_action: "service_synced_with_stripe",
          p_resource_type: "service",
          p_resource_id: service_id,
          p_metadata: {
            product_id: productId,
            price_id: priceId,
            price_cents: service.price_cents,
          },
        });

        return NextResponse.json({
          service_id: service.id,
          product_id: productId,
          price_id: priceId,
          synced: true,
        });
      } catch (stripeError: any) {
        console.error("Error sincronizando con Stripe:", stripeError);
        return NextResponse.json(
          { error: `Error sincronizando con Stripe: ${stripeError?.message ?? "Error desconocido"}` },
          { status: 500 }
        );
      }
    } else {
      // Sincronizar todos los servicios del tenant
      const { tenant_id } = body as SyncAllRequest;

      if (!tenant_id) {
        return NextResponse.json(
          { error: "tenant_id es requerido" },
          { status: 400 }
        );
      }

      // Obtener servicios sin price_id
      const { data: services, error: servicesError } = await supabase
        .from("services")
        .select("id, tenant_id, name, price_cents, duration_min, active, stripe_product_id, stripe_price_id")
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .or("stripe_price_id.is.null,stripe_price_id.eq.''");

      if (servicesError) {
        return NextResponse.json(
          { error: `Error al obtener servicios: ${servicesError.message}` },
          { status: 500 }
        );
      }

      const results: Array<{
        service_id: string;
        product_id: string | null;
        price_id: string | null;
        synced: boolean;
        error?: string;
      }> = [];

      // Sincronizar cada servicio
      for (const service of services || []) {
        try {
          // Crear o actualizar producto
          let productId = service.stripe_product_id;
          if (!productId) {
            const product = await stripe.products.create({
              name: service.name,
              active: service.active,
              metadata: {
                tenant_id: tenant_id,
                service_id: service.id,
              },
            });
            productId = product.id;
          } else {
            await stripe.products.update(productId, {
              name: service.name,
              active: service.active,
              metadata: {
                tenant_id: tenant_id,
                service_id: service.id,
              },
            });
          }

          // Crear nuevo precio
          let priceId = service.stripe_price_id;
          if (!priceId) {
            const price = await stripe.prices.create({
              product: productId,
              currency: CURRENCY,
              unit_amount: service.price_cents,
              metadata: {
                tenant_id: tenant_id,
                service_id: service.id,
              },
            });
            priceId = price.id;
          } else {
            // Verificar si el precio actual coincide
            try {
              const existingPrice = await stripe.prices.retrieve(priceId);
              if (existingPrice.unit_amount !== service.price_cents) {
                // Desactivar precio anterior
                await stripe.prices.update(priceId, { active: false });
                // Crear nuevo precio
                const newPrice = await stripe.prices.create({
                  product: productId,
                  currency: CURRENCY,
                  unit_amount: service.price_cents,
                  metadata: {
                    tenant_id: tenant_id,
                    service_id: service.id,
                  },
                });
                priceId = newPrice.id;
              }
            } catch (error) {
              // Precio no encontrado, crear nuevo
              const price = await stripe.prices.create({
                product: productId,
                currency: CURRENCY,
                unit_amount: service.price_cents,
                metadata: {
                  tenant_id: tenant_id,
                  service_id: service.id,
                },
              });
              priceId = price.id;
            }
          }

          // Actualizar servicio
          const { error: updateError } = await supabase
            .from("services")
            .update({
              stripe_product_id: productId,
              stripe_price_id: priceId,
            })
            .eq("id", service.id);

          if (updateError) {
            results.push({
              service_id: service.id,
              product_id: productId,
              price_id: priceId,
              synced: false,
              error: updateError.message,
            });
            continue;
          }

          // Auditar cambio
          await supabase.rpc("create_log", {
            p_tenant_id: tenant_id,
            p_user_id: userId,
            p_action: "service_synced_with_stripe",
            p_resource_type: "service",
            p_resource_id: service.id,
            p_metadata: {
              product_id: productId,
              price_id: priceId,
              price_cents: service.price_cents,
            },
          });

          results.push({
            service_id: service.id,
            product_id: productId,
            price_id: priceId,
            synced: true,
          });
        } catch (error: any) {
          results.push({
            service_id: service.id,
            product_id: service.stripe_product_id,
            price_id: service.stripe_price_id,
            synced: false,
            error: error?.message ?? "Error desconocido",
          });
        }
      }

      return NextResponse.json({
        synced: results.filter((r) => r.synced).length,
        failed: results.filter((r) => !r.synced).length,
        total: results.length,
        details: results,
      });
    }
  } catch (err: any) {
    console.error("Error en payments/services/sync:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

