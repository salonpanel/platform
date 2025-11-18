# 🔧 Solución al Error de Turbopack

## Error
```
An unexpected Turbopack error occurred. Please see the output of `next dev` for more details.
```

## Causas Comunes

1. **Imports circulares** entre componentes
2. **Imports incorrectos** o archivos que no existen
3. **Acceso a `document` o `window` antes del montaje** del componente
4. **Errores de sintaxis** en archivos TypeScript/TSX
5. **Cache corrupto** de Next.js/Turbopack

## Soluciones Aplicadas

### 1. Eliminado import innecesario en Modal.tsx
- Se eliminó `import { Button } from "./Button"` que no se estaba usando

### 2. Corregido acceso a `document.body` en Modal
- Ahora solo se accede a `document.body` después de que el componente esté montado
- Los `useEffect` verifican `mounted` antes de acceder al DOM

### 3. Añadido `suppressHydrationWarning` al body
- Soluciona problemas de hidratación causados por extensiones del navegador

## Pasos para Resolver

### 1. Limpiar cache y reiniciar
```bash
# Detener el servidor (Ctrl+C)
# Eliminar cache
Remove-Item -Recurse -Force .next

# Reiniciar
npm run dev
```

### 2. Verificar errores en la terminal
El error de Turbopack muestra detalles en la terminal donde corre `npm run dev`. Busca:
- Errores de importación
- Errores de sintaxis
- Archivos no encontrados

### 3. Verificar imports
Asegúrate de que todos los imports sean correctos:
```typescript
// ✅ Correcto
import { Button } from "@/components/ui/Button";

// ❌ Incorrecto
import { Button } from "./Button"; // Si no está en el mismo directorio
```

### 4. Verificar acceso al DOM
Solo accede a `document` o `window` después del montaje:
```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

useEffect(() => {
  if (!mounted) return;
  // Ahora puedes acceder a document/window
  document.body.style.overflow = "hidden";
}, [mounted]);
```

## Si el Error Persiste

1. **Revisa la terminal** donde corre `npm run dev` para ver el error completo
2. **Comparte el error completo** de la terminal (no solo el del navegador)
3. **Verifica que todos los archivos existan**:
   - `src/components/ui/Modal.tsx`
   - `src/components/ui/Button.tsx`
   - `src/lib/utils.ts`

## Comandos Útiles

```bash
# Limpiar todo
Remove-Item -Recurse -Force .next node_modules
npm install
npm run dev

# Verificar TypeScript
npx tsc --noEmit

# Verificar lint
npm run lint
```

---

**Última actualización**: 2024-11-14






