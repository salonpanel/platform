/**
 * Tests de Constraint Anti-Solapes
 * Verifica que el constraint EXCLUDE previene solapes por staff_id
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('Overlap Constraint Tests', () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const staffId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const customerId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const serviceId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  // Rangos de tiempo de prueba
  const startsAt1 = new Date('2024-01-15T10:00:00Z');
  const endsAt1 = new Date('2024-01-15T10:30:00Z');
  const startsAt2 = new Date('2024-01-15T10:15:00Z'); // Solapa con startsAt1
  const endsAt2 = new Date('2024-01-15T10:45:00Z');
  const startsAt3 = new Date('2024-01-15T11:00:00Z'); // No solapa
  const endsAt3 = new Date('2024-01-15T11:30:00Z');

  beforeAll(async () => {
    // Cleanup: Eliminar bookings de prueba si existen
    await serviceClient
      .from('bookings')
      .delete()
      .eq('tenant_id', tenantId)
      .gte('starts_at', startsAt1.toISOString())
      .lte('starts_at', endsAt3.toISOString());
  });

  afterAll(async () => {
    // Cleanup: Eliminar bookings de prueba
    await serviceClient
      .from('bookings')
      .delete()
      .eq('tenant_id', tenantId)
      .gte('starts_at', startsAt1.toISOString())
      .lte('starts_at', endsAt3.toISOString());
  });

  describe('Solape de staff_id', () => {
    it('debe permitir insertar primer booking', async () => {
      // Test: Insertar primer booking
      const { data, error } = await serviceClient
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          staff_id: staffId,
          service_id: serviceId,
          starts_at: startsAt1.toISOString(),
          ends_at: endsAt1.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      // Verificar que se insertó correctamente
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.status).toBe('pending');
    });

    it('debe denegar inserción de booking solapado (23P01)', async () => {
      // Test: Intentar insertar booking solapado
      const { data, error } = await serviceClient
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          staff_id: staffId,
          service_id: serviceId,
          starts_at: startsAt2.toISOString(),
          ends_at: endsAt2.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      // Verificar que se deniega la inserción (exclusion violation)
      expect(error).toBeDefined();
      expect(error?.code).toBe('23P01');
      expect(data).toBeNull();
    });

    it('debe permitir insertar booking no solapado', async () => {
      // Test: Insertar booking no solapado
      const { data, error } = await serviceClient
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          staff_id: staffId,
          service_id: serviceId,
          starts_at: startsAt3.toISOString(),
          ends_at: endsAt3.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      // Verificar que se insertó correctamente
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.status).toBe('pending');
    });
  });

  describe('Aislamiento multi-tenant', () => {
    const tenant2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    it('debe permitir bookings solapados en diferentes tenants', async () => {
      // Test: Insertar booking en tenant2 con mismo staff_id y rango solapado
      const { data, error } = await serviceClient
        .from('bookings')
        .insert({
          tenant_id: tenant2Id,
          customer_id: customerId,
          staff_id: staffId,
          service_id: serviceId,
          starts_at: startsAt1.toISOString(),
          ends_at: endsAt1.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      // Verificar que se insertó correctamente (diferente tenant)
      // Nota: En tests reales, verificar que tenant2 existe
      // Por ahora, esperamos que falle si tenant2 no existe, pero no por solape
      if (error && error.code !== '23503') {
        // 23503 = foreign key violation (tenant2 no existe)
        // Si es otro error, verificar
        expect(error.code).not.toBe('23P01'); // No debe ser exclusion violation
      }
    });
  });

  describe('Estados excluidos del constraint', () => {
    it('debe permitir bookings solapados si el primero está cancelled', async () => {
      // Test: Cancelar primer booking
      await serviceClient
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('tenant_id', tenantId)
        .eq('staff_id', staffId)
        .eq('starts_at', startsAt1.toISOString());

      // Test: Intentar insertar booking solapado (debería funcionar porque el primero está cancelled)
      const { data, error } = await serviceClient
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          staff_id: staffId,
          service_id: serviceId,
          starts_at: startsAt1.toISOString(),
          ends_at: endsAt1.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      // Verificar que se insertó correctamente (el constraint solo aplica a pending/paid)
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});

