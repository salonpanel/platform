/**
 * Tests básicos para utilidades multi-tenant
 * 
 * Para ejecutar: npm test (si está configurado Jest/Vitest)
 * O ejecutar manualmente: node -r ts-node/register src/lib/__tests__/multiTenant.test.ts
 */

import { isValidTenantSlug } from "../multiTenant";

// Tests básicos de isValidTenantSlug
function testIsValidTenantSlug() {
  console.log("🧪 Testing isValidTenantSlug()...\n");

  const testCases = [
    // Casos válidos
    { slug: "barberstudio", expected: true, description: "Slug válido simple" },
    { slug: "barber-studio", expected: true, description: "Slug válido con guión" },
    { slug: "barber123", expected: true, description: "Slug válido con números" },
    { slug: "barber-studio-123", expected: true, description: "Slug válido complejo" },
    
    // Casos inválidos - formato
    { slug: "", expected: false, description: "Slug vacío" },
    { slug: "BarberStudio", expected: false, description: "Slug con mayúsculas" },
    { slug: "barber_studio", expected: false, description: "Slug con guión bajo" },
    { slug: "barber studio", expected: false, description: "Slug con espacios" },
    { slug: "barber@studio", expected: false, description: "Slug con caracteres especiales" },
    { slug: "-barberstudio", expected: false, description: "Slug que empieza con guión" },
    { slug: "barberstudio-", expected: false, description: "Slug que termina con guión" },
    { slug: "barber--studio", expected: false, description: "Slug con guiones consecutivos" },
    
    // Casos inválidos - subdominios reservados
    { slug: "pro", expected: false, description: "Subdominio reservado: pro" },
    { slug: "admin", expected: false, description: "Subdominio reservado: admin" },
    { slug: "www", expected: false, description: "Subdominio reservado: www" },
    { slug: "api", expected: false, description: "Subdominio reservado: api" },
    { slug: "mail", expected: false, description: "Subdominio reservado: mail" },
    { slug: "cdn", expected: false, description: "Subdominio reservado: cdn" },
    { slug: "smtp", expected: false, description: "Subdominio reservado: smtp" },
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach(({ slug, expected, description }) => {
    const result = isValidTenantSlug(slug);
    const success = result === expected;
    
    if (success) {
      console.log(`✅ ${description}: "${slug}" → ${result}`);
      passed++;
    } else {
      console.error(`❌ ${description}: "${slug}" → ${result} (esperado: ${expected})`);
      failed++;
    }
  });

  console.log(`\n📊 Resultados: ${passed} pasados, ${failed} fallidos\n`);
  return failed === 0;
}

// Tests básicos de getAppContextFromHost (simulación)
function testGetAppContextFromHost() {
  console.log("🧪 Testing getAppContextFromHost() (simulación)...\n");

  // Importar dinámicamente para evitar problemas de circular dependency
  const { getAppContextFromHost } = require("../domains");

  const testCases = [
    { host: "pro.bookfast.es", expected: "pro", description: "Dominio pro" },
    { host: "admin.bookfast.es", expected: "admin", description: "Dominio admin" },
    { host: "barberstudio.bookfast.es", expected: "tenantPublic", description: "Dominio tenant" },
    { host: "bookfast.es", expected: "marketing", description: "Dominio marketing" },
    { host: "localhost:3000", expected: "pro", description: "Localhost (default pro)" },
    { host: "127.0.0.1:3000", expected: "pro", description: "127.0.0.1 (default pro)" },
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach(({ host, expected, description }) => {
    try {
      const result = getAppContextFromHost(host);
      const success = result === expected;
      
      if (success) {
        console.log(`✅ ${description}: "${host}" → ${result}`);
        passed++;
      } else {
        console.error(`❌ ${description}: "${host}" → ${result} (esperado: ${expected})`);
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${description}: Error - ${error}`);
      failed++;
    }
  });

  console.log(`\n📊 Resultados: ${passed} pasados, ${failed} fallidos\n`);
  return failed === 0;
}

// Ejecutar tests si se ejecuta directamente
if (require.main === module) {
  console.log("🚀 Ejecutando tests básicos de multi-tenant...\n");
  
  const test1 = testIsValidTenantSlug();
  const test2 = testGetAppContextFromHost();
  
  if (test1 && test2) {
    console.log("✅ Todos los tests pasaron");
    process.exit(0);
  } else {
    console.error("❌ Algunos tests fallaron");
    process.exit(1);
  }
}

export { testIsValidTenantSlug, testGetAppContextFromHost };


