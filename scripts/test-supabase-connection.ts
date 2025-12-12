/**
 * Script para verificar la conexión a Supabase
 * 
 * Uso:
 *   npm run test:supabase-connection
 *   o
 *   ts-node scripts/test-supabase-connection.ts
 */

// Cargar variables de entorno desde .env.local
import { config } from 'dotenv'
import { resolve } from 'path'

// Cargar .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// Cargar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Verificando configuración de Supabase...\n')

// Validar que las variables existan
if (!supabaseUrl) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL no está definida')
  console.log('   Por favor, configura tu archivo .env.local')
  process.exit(1)
}

if (!supabaseKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_ANON_KEY no está definida')
  console.log('   Por favor, configura tu archivo .env.local')
  process.exit(1)
}

console.log('✅ Variables de entorno encontradas')
console.log(`   URL: ${supabaseUrl}`)
console.log(`   Key: ${supabaseKey.substring(0, 20)}...`)
console.log('')

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('🔌 Probando conexión a Supabase...\n')

  try {
    // Test 1: Health check básico
    console.log('Test 1: Health check...')
    const { data: healthData, error: healthError } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    if (healthError) {
      console.error('❌ Error en health check:', healthError.message)
      throw healthError
    }
    
    console.log('✅ Health check exitoso')
    console.log('')

    // Test 2: Verificar autenticación
    console.log('Test 2: Verificando auth...')
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError) {
      console.warn('⚠️  Warning en auth:', authError.message)
    }
    
    if (session) {
      console.log('✅ Sesión activa detectada')
      console.log(`   User: ${session.user.email}`)
    } else {
      console.log('ℹ️  No hay sesión activa (normal en scripts)')
    }
    console.log('')

    // Test 3: Contar usuarios
    console.log('Test 3: Contando registros en tabla users...')
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('❌ Error al contar usuarios:', countError.message)
    } else {
      console.log(`✅ Tabla users tiene ${count} registros`)
    }
    console.log('')

    // Test 4: Verificar tablas principales
    console.log('Test 4: Verificando tablas principales...')
    const tables = ['users', 'companies', 'services', 'appointments', 'schedules']
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1)
      
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`)
      } else {
        console.log(`   ✅ ${table}`)
      }
    }
    console.log('')

    // Resumen final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 ¡Conexión a Supabase exitosa!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('Siguiente paso:')
    console.log('  - Ejecuta: npm run dev')
    console.log('  - Abre: http://localhost:3000')
    console.log('')

  } catch (error: any) {
    console.error('')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ Error de conexión a Supabase')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('')
    console.error('Detalles del error:')
    console.error(error)
    console.error('')
    console.error('Posibles soluciones:')
    console.error('  1. Verifica que Supabase esté corriendo: npm run supabase:status')
    console.error('  2. Si usas local, inicia Supabase: npm run supabase:start')
    console.error('  3. Verifica tu archivo .env.local')
    console.error('  4. Comprueba que las URLs y keys sean correctas')
    console.error('')
    process.exit(1)
  }
}

// Ejecutar test
testConnection()
