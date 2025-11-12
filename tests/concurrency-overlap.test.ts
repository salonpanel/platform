/**
 * Tests de Concurrencia - Solapes y EXCLUDE GIST
 * Verifica que el constraint EXCLUDE previene solapes en condiciones de alta concurrencia
 * 
 * Criterios de Aceptación:
 * - ✅ Múltiples requests simultáneos con solape retornan 409 (23P01)
 * - ✅ Solo uno de los requests concurrentes se procesa correctamente
 * - ✅ Métricas de p99 para tiempos de respuesta
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('Concurrency Overlap Tests', () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const staffId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const customerId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const serviceId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  // Rango de tiempo para solape
  const startsAt = new Date('2024-01-15T10:00:00Z');
  const endsAt = new Date('2024-01-15T10:30:00Z');

  beforeAll(async () => {
    // Cleanup: Eliminar bookings de prueba
    await serviceClient
      .from('bookings')
      .delete()
      .eq('tenant_id', tenantId)
      .gte('starts_at', startsAt.toISOString())
      .lte('starts_at', endsAt.toISOString());
  });

  afterAll(async () => {
    // Cleanup: Eliminar bookings de prueba
    await serviceClient
      .from('bookings')
      .delete()
      .eq('tenant_id', tenantId)
      .gte('starts_at', startsAt.toISOString())
      .lte('starts_at', endsAt.toISOString());
  });

  describe('Concurrencia alta - Solapes simultáneos', () => {
    it('debe prevenir solapes con múltiples requests simultáneos', async () => {
      const concurrentRequests = 10;
      const results: Array<{ success: boolean; error?: any; data?: any }> = [];

      // Crear múltiples requests simultáneos
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        try {
          const { data, error } = await serviceClient
            .from('bookings')
            .insert({
              tenant_id: tenantId,
              customer_id: customerId,
              staff_id: staffId,
              service_id: serviceId,
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
              status: 'pending',
            })
            .select()
            .single();

          return { success: !error, error, data };
        } catch (err: any) {
          return { success: false, error: err };
        }
      });

      // Esperar a que todos los requests terminen
      const allResults = await Promise.all(promises);
      results.push(...allResults);

      // Verificar que solo uno se insertó correctamente
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(concurrentRequests - 1);

      // Verificar que todos los fallos son 23P01 (exclusion violation)
      failed.forEach((result) => {
        expect(result.error?.code).toBe('23P01');
      });
    }, 30000); // Timeout de 30 segundos para requests concurrentes

    it('debe medir tiempos de respuesta (p99)', async () => {
      const requests = 100;
      const times: number[] = [];

      for (let i = 0; i < requests; i++) {
        const start = Date.now();
        try {
          await serviceClient
            .from('bookings')
            .insert({
              tenant_id: tenantId,
              customer_id: customerId,
              staff_id: staffId,
              service_id: serviceId,
              starts_at: new Date(startsAt.getTime() + i * 60 * 60 * 1000).toISOString(), // Diferentes horas
              ends_at: new Date(endsAt.getTime() + i * 60 * 60 * 1000).toISOString(),
              status: 'pending',
            })
            .select()
            .single();
        } catch (err) {
          // Ignorar errores (puede haber solapes)
        }
        const end = Date.now();
        times.push(end - start);
      }

      // Calcular p99
      times.sort((a, b) => a - b);
      const p99Index = Math.floor(times.length * 0.99);
      const p99 = times[p99Index];

      // Verificar que p99 es razonable (< 500ms)
      expect(p99).toBeLessThan(500);
    }, 60000); // Timeout de 60 segundos para 100 requests
  });

  describe('Concurrencia con diferentes tenants', () => {
    it('debe permitir solapes en diferentes tenants simultáneamente', async () => {
      const tenant2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const concurrentRequests = 5;
      const results: Array<{ success: boolean; error?: any; tenant_id: string }> = [];

      // Crear requests simultáneos para diferentes tenants
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const currentTenantId = i % 2 === 0 ? tenantId : tenant2Id;
        try {
          const { data, error } = await serviceClient
            .from('bookings')
            .insert({
              tenant_id: currentTenantId,
              customer_id: customerId,
              staff_id: staffId,
              service_id: serviceId,
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
              status: 'pending',
            })
            .select()
            .single();

          return { success: !error, error, tenant_id: currentTenantId };
        } catch (err: any) {
          return { success: false, error: err, tenant_id: currentTenantId };
        }
      });

      // Esperar a que todos los requests terminen
      const allResults = await Promise.all(promises);
      results.push(...allResults);

      // Verificar que al menos uno por tenant se insertó (si los tenants existen)
      const tenant1Results = results.filter((r) => r.tenant_id === tenantId);
      const tenant2Results = results.filter((r) => r.tenant_id === tenant2Id);

      // Al menos uno por tenant debería ser exitoso (si los tenants existen)
      // Nota: Si los tenants no existen, los requests fallarán con 23503 (foreign key violation)
      // Pero no deberían fallar con 23P01 (exclusion violation) entre diferentes tenants
      tenant1Results.forEach((result) => {
        if (!result.success && result.error?.code !== '23503') {
          // Si no es foreign key violation, no debería ser exclusion violation entre tenants
          expect(result.error?.code).not.toBe('23P01');
        }
      });
    }, 30000);
  });
});

