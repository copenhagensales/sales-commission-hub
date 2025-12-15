## Objetivo
- Simplificar `App.tsx` moviendo toda la definición de rutas a una configuración central.
- Hacer las rutas legibles, agrupadas por dominio y nivel de acceso.
- Proveer un flujo claro para añadir nuevas rutas (con guardas de autenticación/roles) sin tocar `App.tsx`.

## Enfoque
- Migrar a un **enrutado basado en configuración** usando objetos de ruta de React Router v6 con `useRoutes`.
- Normalizar el acceso por tipo: `public`, `auth`, `protected`, `role`.
- Centralizar los `lazy` imports en un único módulo de páginas.
- Envolver automáticamente cada ruta con el guarda correcto según su metadato de acceso.

## Cambios propuestos (arquitectura)
1. Crear `src/routes/types.ts` con tipos:
   - `Access = 'public' | 'auth' | 'protected' | 'role'`
   - `RouteConfig` con `path`, `component`, `access`, `requiredRole?`, `requireTeamlederOrAbove?`, `children?`.
2. Crear `src/routes/pages.ts` con todos los `lazy` de páginas actuales a través de un helper `lazyPage(fn)` para mantener consistencia.
3. Crear `src/routes/config.tsx` que exporta un arreglo de `RouteConfig` agrupado por módulos:
   - Núcleo (`/`, `/auth`, `*`)
   - Empleado (schedule, perfil, contratos, etc.)
   - Teamleder+ (dashboard, ventas, payroll, etc.)
   - Vagt-flow (rutas anidadas bajo `/vagt-flow`)
   - Shift planning (anidadas bajo `/shift-planning`)
   - Recruitment (anidadas bajo `/recruitment`)
   - Boards (anidadas bajo `/boards`)
   - Público (survey, wallboard, contratos de firma)
4. Crear `src/routes/guards.tsx` para helpers de guardado:
   - `AuthRoute` (ya existente) y `SmartRedirect` se pueden mantener pero referenciarlas desde aquí.
   - `wrapWithGuard(element, meta)` que devuelve el `element` envuelto en `ProtectedRoute` o `RoleProtectedRoute` según `access` y metadatos.
5. Crear `src/routes/AppRouter.tsx` que:
   - Genera `RouteObject[]` desde `RouteConfig[]` aplicando `wrapWithGuard`.
   - Usa `useRoutes(routeObjects)` dentro de `Suspense` con `PageLoader`.
6. Modificar `src/App.tsx` para:
   - Mantener `ErrorBoundary`, `QueryClientProvider`, `TooltipProvider`, `Toaster/Sonner` y `<BrowserRouter>`.
   - Reemplazar el bloque `<Routes>` por `<AppRouter />`.
7. Añadir guía `src/routes/README.md` (breve) con "cómo añadir una ruta" y ejemplos.

## Mapeo de rutas actuales → configuración
- `"/"` → `access: 'public'` con `SmartRedirect`.
- `"/auth"` → `access: 'auth'` envolviendo `Auth` con `AuthRoute`.
- Público sin auth: `"/onboarding"`, `"/contract/:id"`, `"/contract/sign/:id"`, `"/boards/test"`, `"/boards/economic"`, `"/survey"`.
- `protected` (empleado): `"/my-schedule"`, `"/my-profile"`, `"/my-contracts"`, `"/pulse-survey"`, `"/career-wishes"`, `"/car-quiz"`, `"/code-of-conduct"`, `"/time-stamp"`, `"/extra-work"`, `"/some"`.
- `role` teamleder+ (flag `requireTeamlederOrAbove: true`): dashboard, agents, sales, codan, tdc-erhverv, commission-cpo, payroll, mg-test, mg-test-dashboard, km-test, adversus-data, dialer-data, calls-data, logikker, employees(+detail), teams, settings, vagt-flow (todas excepto `min-uge`), shift-planning (root), shift-planning/absence, shift-planning/time-tracking, extra-work-admin, contracts, pulse-survey-results, career-wishes-overview, car-quiz-admin, code-of-conduct-admin, recruitment (todas sus subrutas).
- `role` específico: `"/admin"` con `requiredRole: 'ejer'`.
- NotFound: `"*"` público.

## Ejemplo de configuración
- Definición de una ruta protegida de empleado:
  - `{ path: '/my-schedule', component: MySchedule, access: 'protected' }`
- Definición de una ruta teamleder+:
  - `{ path: '/dashboard', component: Dashboard, access: 'role', requireTeamlederOrAbove: true }`
- Definición de una ruta owner-only:
  - `{ path: '/admin', component: Admin, access: 'role', requiredRole: 'ejer' }`
- Rutas anidadas (vagt-flow):
  - `{ path: '/vagt-flow', component: VagtFlowIndex, access: 'role', requireTeamlederOrAbove: true, children: [ { path: 'book-week', component: VagtBookWeek, access: 'role', requireTeamlederOrAbove: true }, ... ] }`

## Cómo añadir una nueva ruta
1. Crear/ubicar la página en `src/pages/...` y exportarla en `pages.ts` vía `lazyPage(() => import('...'))`.
2. Añadir un objeto en `src/routes/config.tsx` con:
   - `path`
   - `component` (de `pages.ts`)
   - `access` (`public` | `auth` | `protected` | `role`)
   - Si `access: 'role'`, indicar `requireTeamlederOrAbove` o `requiredRole`.
3. Si necesita anidación, agregarla en `children` bajo el grupo correspondiente.
4. No tocar `App.tsx`: el router se auto-construye desde la configuración.

## Consideraciones
- Performance: todas las páginas siguen `lazy` + `Suspense` con `PageLoader`.
- Seguridad: las guardas (`ProtectedRoute`, `RoleProtectedRoute`, `AuthRoute`) se aplican automáticamente desde metadatos.
- Legibilidad: agrupación por dominio y por acceso; un único lugar para ver/editar rutas.

## Verificación
- Compilar y ejecutar en desarrollo; navegar por las rutas críticas comparando accesos con el comportamiento actual.
- Probar no autenticado vs autenticado, y roles (`teamleder`, `ejer`).
- Verificar redirecciones de `SmartRedirect` y NotFound.

¿Confirmas este plan para proceder con la refactorización e implementación?