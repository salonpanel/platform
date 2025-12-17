#!/usr/bin/env node

/**
 * Script de verificación para detectar usos incorrectos de cookies() en createRouteHandlerClient
 * 
 * Busca el patrón incorrecto: cookies: async () => await cookies()
 * Y verifica que todos usen el patrón correcto: { cookies }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INCORRECT_PATTERN = /cookies:\s*async\s*\(\)\s*=>\s*await\s*cookies\(\)/;
const CORRECT_PATTERN = /createRouteHandlerClient\s*\(\s*\{\s*cookies\s*\}\s*\)/;
const CREATE_ROUTE_HANDLER = /createRouteHandlerClient/;

const filesToCheck = [];
const errors = [];
const warnings = [];

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorar node_modules, .next, etc.
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Solo verificar archivos que usan createRouteHandlerClient
  if (!CREATE_ROUTE_HANDLER.test(content)) {
    return;
  }
  
  // Buscar patrón incorrecto
  if (INCORRECT_PATTERN.test(content)) {
    errors.push({
      file: filePath,
      pattern: 'INCORRECT: cookies: async () => await cookies()',
    });
  }
  
  // Verificar que el import sea correcto
  if (!/import\s+.*cookies.*from\s+['"]next\/headers['"]/.test(content)) {
    if (CREATE_ROUTE_HANDLER.test(content)) {
      warnings.push({
        file: filePath,
        message: 'Missing or incorrect import: import { cookies } from "next/headers"',
      });
    }
  }
}

// Buscar todos los archivos TypeScript
const appDir = path.join(process.cwd(), 'app');
if (fs.existsSync(appDir)) {
  const files = findFiles(appDir);
  files.forEach(checkFile);
}

// Buscar en src también
const srcDir = path.join(process.cwd(), 'src');
if (fs.existsSync(srcDir)) {
  const files = findFiles(srcDir);
  files.forEach(checkFile);
}

// Mostrar resultados
console.log('\n🔍 Verificación de uso de cookies() en createRouteHandlerClient\n');
console.log(`Archivos verificados: ${filesToCheck.length}\n`);

if (errors.length > 0) {
  console.log('❌ ERRORES ENCONTRADOS:\n');
  errors.forEach(({ file, pattern }) => {
    console.log(`  ${file}`);
    console.log(`    ${pattern}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ No se encontraron usos incorrectos de cookies()\n');
}

if (warnings.length > 0) {
  console.log('⚠️  ADVERTENCIAS:\n');
  warnings.forEach(({ file, message }) => {
    console.log(`  ${file}`);
    console.log(`    ${message}\n`);
  });
}

console.log('\n✅ Verificación completada\n');



