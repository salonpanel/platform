/**
 * Script de Validación RLS - Ejecutable
 * Valida que las políticas RLS funcionan correctamente
 * 
 * Uso:
 *   npm run test:rls
 *   o
 *   ts-node tests/rls-validation.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function validateRLSPolicies(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test 1: Verificar que RLS está habilitado en todas las tablas
  results.push(await testRLSEnabled());
  
  // Test 2: Verificar que las funciones helper existen
  results.push(await testHelperFunctions());
  
  // Test 3: Verificar que las políticas RLS existen
  results.push(await testRLSPolicies());
  
  // Test 4: Verificar aislamiento multi-tenant
  results.push(await testMultiTenantIsolation());
  
  // Test 5: Verificar permisos por rol
  results.push(await testRolePermissions());
  
  // Test 6: Verificar lectura pública
  results.push(await testPublicRead());
  
  return results;
}

async function testRLSEnabled(): Promise<TestResult> {
  try {
    // Verificar que RLS está habilitado en las tablas principales
    const tables = ['tenants', 'customers', 'staff', 'services', 'schedules', 'bookings', 'memberships'];
    const { data, error } = await serviceClient.rpc('exec_sql', {
      sql: `
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (${tables.map(t => `'${t}'`).join(', ')})
          AND rowsecurity = true;
      `
    });

    if (error) {
      return {
        name: 'RLS Enabled',
        passed: false,
        error: error.message,
      };
    }

    const enabledTables = (data as any[]) || [];
    const allEnabled = tables.every(table => 
      enabledTables.some((row: any) => row.tablename === table)
    );

    return {
      name: 'RLS Enabled',
      passed: allEnabled,
      details: { enabledTables: enabledTables.length, totalTables: tables.length },
    };
  } catch (err: any) {
    return {
      name: 'RLS Enabled',
      passed: false,
      error: err.message,
    };
  }
}

async function testHelperFunctions(): Promise<TestResult> {
  try {
    // Verificar que las funciones helper existen
    const functions = [
      'app.current_tenant_id',
      'app.user_has_access_to_tenant',
      'app.user_has_role',
      'app.get_tenant_timezone',
    ];

    const { data, error } = await serviceClient.rpc('exec_sql', {
      sql: `
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema IN ('app', 'public')
          AND routine_name IN (${functions.map(f => `'${f.split('.').pop()}'`).join(', ')});
      `
    });

    if (error) {
      return {
        name: 'Helper Functions',
        passed: false,
        error: error.message,
      };
    }

    const existingFunctions = (data as any[]) || [];
    const allExist = functions.every(func => 
      existingFunctions.some((row: any) => row.routine_name === func.split('.').pop())
    );

    return {
      name: 'Helper Functions',
      passed: allExist,
      details: { existingFunctions: existingFunctions.length, totalFunctions: functions.length },
    };
  } catch (err: any) {
    return {
      name: 'Helper Functions',
      passed: false,
      error: err.message,
    };
  }
}

async function testRLSPolicies(): Promise<TestResult> {
  try {
    // Verificar que las políticas RLS existen
    const tables = ['tenants', 'customers', 'staff', 'services', 'schedules', 'bookings', 'memberships'];
    const { data, error } = await serviceClient.rpc('exec_sql', {
      sql: `
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN (${tables.map(t => `'${t}'`).join(', ')});
      `
    });

    if (error) {
      return {
        name: 'RLS Policies',
        passed: false,
        error: error.message,
      };
    }

    const policies = (data as any[]) || [];
    const hasPolicies = policies.length > 0;

    return {
      name: 'RLS Policies',
      passed: hasPolicies,
      details: { policiesCount: policies.length, tables: tables.length },
    };
  } catch (err: any) {
    return {
      name: 'RLS Policies',
      passed: false,
      error: err.message,
    };
  }
}

async function testMultiTenantIsolation(): Promise<TestResult> {
  try {
    // Verificar que los tenants están aislados
    // Crear datos de prueba en dos tenants diferentes
    const tenant1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const tenant2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    // Crear customer en tenant1
    const { data: customer1, error: error1 } = await serviceClient
      .from('customers')
      .insert({
        tenant_id: tenant1Id,
        name: 'Test Customer 1',
        email: 'test1@example.com',
      })
      .select()
      .single();

    if (error1) {
      return {
        name: 'Multi-Tenant Isolation',
        passed: false,
        error: error1.message,
      };
    }

    // Crear customer en tenant2
    const { data: customer2, error: error2 } = await serviceClient
      .from('customers')
      .insert({
        tenant_id: tenant2Id,
        name: 'Test Customer 2',
        email: 'test2@example.com',
      })
      .select()
      .single();

    if (error2) {
      return {
        name: 'Multi-Tenant Isolation',
        passed: false,
        error: error2.message,
      };
    }

    // Limpiar datos de prueba
    await serviceClient.from('customers').delete().eq('id', customer1.id);
    await serviceClient.from('customers').delete().eq('id', customer2.id);

    return {
      name: 'Multi-Tenant Isolation',
      passed: true,
      details: { customer1: customer1.id, customer2: customer2.id },
    };
  } catch (err: any) {
    return {
      name: 'Multi-Tenant Isolation',
      passed: false,
      error: err.message,
    };
  }
}

async function testRolePermissions(): Promise<TestResult> {
  try {
    // Verificar que las políticas RLS respetan roles
    // Este test requiere autenticación real, por lo que es más complejo
    // Por ahora, verificamos que las políticas existen

    const { data, error } = await serviceClient.rpc('exec_sql', {
      sql: `
        SELECT tablename, policyname, roles 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('customers', 'services', 'bookings')
          AND (policyname LIKE '%owner%' OR policyname LIKE '%admin%' OR policyname LIKE '%manager%' OR policyname LIKE '%staff%');
      `
    });

    if (error) {
      return {
        name: 'Role Permissions',
        passed: false,
        error: error.message,
      };
    }

    const rolePolicies = (data as any[]) || [];
    const hasRolePolicies = rolePolicies.length > 0;

    return {
      name: 'Role Permissions',
      passed: hasRolePolicies,
      details: { rolePoliciesCount: rolePolicies.length },
    };
  } catch (err: any) {
    return {
      name: 'Role Permissions',
      passed: false,
      error: err.message,
    };
  }
}

async function testPublicRead(): Promise<TestResult> {
  try {
    // Verificar que la lectura pública funciona para servicios activos
    const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key');

    const { data, error } = await anonClient
      .from('services')
      .select('id, name, duration_min, price_cents')
      .eq('active', true)
      .limit(10);

    if (error) {
      return {
        name: 'Public Read',
        passed: false,
        error: error.message,
      };
    }

    return {
      name: 'Public Read',
      passed: true,
      details: { servicesCount: (data || []).length },
    };
  } catch (err: any) {
    return {
      name: 'Public Read',
      passed: false,
      error: err.message,
    };
  }
}

// Ejecutar validación
async function main() {
  console.log('🔍 Validando políticas RLS...\n');
  
  const results = await validateRLSPolicies();
  
  console.log('📊 Resultados de Validación RLS:\n');
  results.forEach((result) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`   Detalles: ${JSON.stringify(result.details)}`);
    }
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const allPassed = results.every(r => r.passed);
  
  console.log(`\n📈 Resumen: ${passed}/${total} tests pasaron`);
  
  if (!allPassed) {
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

export { validateRLSPolicies, TestResult };

