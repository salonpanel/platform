# Checklist de Testing - Nueva Interfaz de Agenda

## 📋 Testing Funcional

### Navegación de Fecha
- [ ] **Botón "Hoy"** lleva a fecha actual
- [ ] **Flecha izquierda** navega a fecha anterior según vista
  - [ ] En vista Día: -1 día
  - [ ] En vista Semana: -1 semana
  - [ ] En vista Mes: -1 mes
  - [ ] En vista Lista: -1 día
- [ ] **Flecha derecha** navega a fecha siguiente según vista
  - [ ] En vista Día: +1 día
  - [ ] En vista Semana: +1 semana
  - [ ] En vista Mes: +1 mes
  - [ ] En vista Lista: +1 día
- [ ] **Date picker** abre al hacer click en icono 📅
- [ ] **Date picker** cierra al seleccionar fecha
- [ ] **Date picker** cierra al hacer click fuera
- [ ] Fecha seleccionada actualiza el calendario correctamente

### Vistas del Calendario
- [ ] **Vista Día** muestra correctamente
- [ ] **Vista Semana** muestra correctamente
- [ ] **Vista Mes** muestra correctamente
- [ ] **Vista Lista** muestra correctamente
- [ ] Cambio entre vistas mantiene fecha seleccionada
- [ ] Vista activa tiene estilo diferenciado (blanco)

### Filtro de Barberos
- [ ] **Dropdown abre** al hacer click en "👥 Barberos"
- [ ] **Dropdown cierra** al hacer click fuera
- [ ] "Todos los barberos" deselecciona todos
- [ ] Selección individual de barbero funciona
- [ ] Multi-selección de barberos funciona
- [ ] **Badge numérico** muestra cantidad correcta
- [ ] Checkmark aparece en barberos seleccionados
- [ ] Calendario filtra por barberos seleccionados
- [ ] Sin barberos seleccionados = muestra todos

### Filtro de Estado
- [ ] **Dropdown abre** al hacer click en "✓ Estado"
- [ ] **Dropdown cierra** al hacer click fuera
- [ ] Selección de "Pendiente" funciona
- [ ] Selección de "Pagado" funciona
- [ ] Selección de "Completado" funciona
- [ ] Selección de "Cancelado" funciona
- [ ] Selección de "No Show" funciona
- [ ] Selección de "Hold" funciona
- [ ] Multi-selección de estados funciona
- [ ] **Badge numérico** muestra cantidad correcta
- [ ] Checkmark aparece en estados seleccionados
- [ ] Colores de estado correctos en dropdown
- [ ] Calendario filtra por estados seleccionados

### Filtro de Destacadas
- [ ] **Click activa** filtro de destacadas
- [ ] **Click desactiva** filtro de destacadas
- [ ] Estilo cambia cuando está activo (rosa)
- [ ] Calendario muestra solo citas destacadas cuando activo
- [ ] Ícono de estrella visible

### Botón Limpiar Filtros
- [ ] **No visible** cuando no hay filtros activos
- [ ] **Aparece** cuando se aplica algún filtro
- [ ] **Animación** de entrada es suave
- [ ] **Click limpia** todos los filtros:
  - [ ] Barberos deseleccionados
  - [ ] Estados deseleccionados
  - [ ] Destacadas desactivado
- [ ] Badges desaparecen después de limpiar
- [ ] Calendario vuelve a mostrar todo

### Búsqueda
- [ ] **Icono 🔍** abre panel de búsqueda
- [ ] Panel de búsqueda funciona correctamente
- [ ] Búsqueda filtra resultados
- [ ] Cerrar búsqueda restaura vista

### Notificaciones
- [ ] **Icono 🔔** abre notificaciones
- [ ] Badge muestra cantidad correcta (si >0)
- [ ] Badge con "9+" si >9 notificaciones
- [ ] Animación del badge es suave

---

## 🎨 Testing Visual

### Diseño y Espaciado
- [ ] Título tiene tamaño correcto (text-base)
- [ ] Ícono de calendario es 9x9px
- [ ] Botones son 9x9px (36px con padding)
- [ ] Espaciado entre elementos es consistente
- [ ] No hay overlaps de elementos
- [ ] Dropdowns no se salen de pantalla

### Animaciones
- [ ] Hover en botones tiene efecto scale (1.02)
- [ ] Tap en botones tiene efecto scale (0.98)
- [ ] Dropdowns entran con fade + translateY
- [ ] Badge de notificaciones usa spring animation
- [ ] Transiciones son suaves (150-200ms)
- [ ] No hay janking en animaciones

### Estados Visuales
- [ ] Botones inactivos: `bg-white/5`
- [ ] Botones hover: `bg-white/10`
- [ ] Botones activos: tienen estilo diferenciado
- [ ] Dropdown activo: `bg-white/10`
- [ ] Vista activa: `bg-white` con texto oscuro
- [ ] Destacadas activo: rosa/pink

### Colores de Estado
- [ ] Pendiente: Amarillo/Amber
- [ ] Pagado: Verde/Emerald
- [ ] Completado: Aqua (#4FE3C1)
- [ ] Cancelado: Rojo/Red
- [ ] No Show: Gris/White/40
- [ ] Hold: Morado (#A06BFF)

### Badges
- [ ] Badge tiene fondo #4FE3C1
- [ ] Badge tiene texto oscuro (#0E0F11)
- [ ] Badge es legible
- [ ] Badge no deforma el botón
- [ ] Badge con "9+" funciona correctamente

---

## 📱 Testing Responsive

### Desktop (≥1024px)
- [ ] Dos filas compactas en header
- [ ] Todos los filtros visibles
- [ ] Calendario usa ancho completo
- [ ] No hay scroll horizontal
- [ ] Dropdowns tienen espacio para desplegar

### Tablet (768-1023px)
- [ ] Layout se adapta correctamente
- [ ] Elementos hacen wrap si necesario
- [ ] Touch targets son accesibles (≥44px)
- [ ] Dropdowns no salen de viewport

### Mobile (<768px)
- [ ] Stack vertical funciona
- [ ] Botones son touch-friendly
- [ ] Dropdowns se adaptan a ancho
- [ ] No hay elementos cortados
- [ ] Scroll vertical funciona
- [ ] Date picker es usable en touch

---

## 🔧 Testing Técnico

### Performance
- [ ] No hay memory leaks (event listeners limpios)
- [ ] Dropdowns no causan re-renders innecesarios
- [ ] Filtrado es instantáneo (<100ms)
- [ ] Navegación es fluida
- [ ] Sin warnings en consola

### TypeScript
- [ ] Sin errores de tipo
- [ ] Props opcionales funcionan con defaults
- [ ] Callbacks tienen tipos correctos
- [ ] Interfaces exportadas correctamente

### Compatibilidad
- [ ] Funciona en Chrome
- [ ] Funciona en Firefox
- [ ] Funciona en Safari
- [ ] Funciona en Edge
- [ ] Date picker nativo funciona en todos

### Accesibilidad
- [ ] Todos los botones tienen `aria-label`
- [ ] Focus states son visibles
- [ ] Navegación por teclado funciona
- [ ] Screen readers pueden leer labels
- [ ] Contraste de colores es adecuado

---

## 🧪 Testing de Casos Extremos

### Sin Datos
- [ ] Sin barberos: dropdown no muestra error
- [ ] Sin citas: calendario muestra empty state
- [ ] Sin notificaciones: badge no aparece

### Muchos Datos
- [ ] Muchos barberos: dropdown tiene scroll
- [ ] Todos los estados seleccionados: badge correcto
- [ ] Muchas notificaciones: muestra "9+"
- [ ] Dropdown con >20 items scrollea correctamente

### Combinaciones de Filtros
- [ ] Barbero + Estado funciona
- [ ] Barbero + Destacadas funciona
- [ ] Estado + Destacadas funciona
- [ ] Todos los filtros juntos funcionan
- [ ] Limpiar con todos activos funciona

### Navegación Rápida
- [ ] Clicks rápidos en navegación no rompen
- [ ] Cambio rápido de vista funciona
- [ ] Aplicar/quitar filtros rápido funciona
- [ ] Abrir/cerrar dropdowns rápido funciona

### Estados Inconsistentes
- [ ] Cambiar fecha con filtros activos
- [ ] Cambiar vista con filtros activos
- [ ] Filtros sin resultados muestra mensaje
- [ ] Barbero seleccionado ya no existe

---

## 🎯 Testing de Flujos Completos

### Flujo 1: Usuario busca citas de un barbero específico
1. [ ] Abre página de agenda
2. [ ] Click en "👥 Barberos"
3. [ ] Selecciona un barbero
4. [ ] Dropdown cierra
5. [ ] Badge muestra "1"
6. [ ] Calendario filtra correctamente
7. [ ] Click en "🔄 Limpiar"
8. [ ] Todo vuelve a normal

### Flujo 2: Usuario busca citas pendientes de pago
1. [ ] Abre página de agenda
2. [ ] Click en "✓ Estado"
3. [ ] Selecciona "Pendiente"
4. [ ] Dropdown cierra
5. [ ] Badge muestra "1"
6. [ ] Solo citas pendientes visibles
7. [ ] Navega entre días
8. [ ] Filtro se mantiene activo

### Flujo 3: Usuario ve citas VIP de la semana
1. [ ] Cambia a vista "Semana"
2. [ ] Click en "⭐ Destacadas"
3. [ ] Botón se activa (rosa)
4. [ ] Solo citas destacadas visibles
5. [ ] Navega semanas
6. [ ] Filtro se mantiene
7. [ ] Click en "⭐ Destacadas" para desactivar

### Flujo 4: Usuario planifica para fecha específica
1. [ ] Click en icono 📅
2. [ ] Selecciona fecha futura
3. [ ] Picker cierra
4. [ ] Calendario salta a esa fecha
5. [ ] Aplica filtros si necesario
6. [ ] Navega días adyacentes

### Flujo 5: Múltiples filtros combinados
1. [ ] Selecciona 2 barberos
2. [ ] Selecciona 3 estados
3. [ ] Activa destacadas
4. [ ] Badges muestran "2", "3"
5. [ ] Botón destacadas rosa
6. [ ] Calendario filtra correctamente
7. [ ] "🔄 Limpiar" aparece
8. [ ] Click limpia todo de una vez

---

## ✅ Criterios de Aceptación

### Obligatorios (Bloqueantes)
- [ ] Todos los filtros funcionan correctamente
- [ ] Navegación de fecha sin errores
- [ ] Calendario muestra datos correctos
- [ ] No hay errores en consola
- [ ] No hay errores TypeScript
- [ ] Responsive funciona en los 3 breakpoints

### Importantes (Altas)
- [ ] Animaciones son suaves
- [ ] UX es intuitiva
- [ ] Performance es buena (<100ms)
- [ ] Accesibilidad básica cumplida
- [ ] Colores y estilos consistentes

### Deseables (Medias)
- [ ] Animaciones premium funcionan
- [ ] Todos los edge cases cubiertos
- [ ] Navegación por teclado completa
- [ ] Documentación actualizada

---

## 📊 Resultados del Testing

### Resumen
- **Total tests**: ___/___
- **Pasados**: ___
- **Fallidos**: ___
- **Bloqueantes**: ___
- **No aplicables**: ___

### Issues Encontrados
1. 
2. 
3. 

### Notas Adicionales


---

**Tester**: ___________________  
**Fecha**: ___________________  
**Versión testeada**: 1.0.0  
**Browser/OS**: ___________________  
**Estado**: [ ] Aprobado [ ] Rechazado [ ] Pendiente
