# Guía de rutas

Esta carpeta centraliza el enrutado de la aplicación mediante una configuración declarativa. Añade, modifica o elimina rutas sin tocar `src/App.tsx`.

## Conceptos clave
- Tipos de acceso: `public`, `auth`, `protected`, `role`.
- Guardas automáticas: cada ruta se envuelve con la guarda correcta según su metadato.
- Anidación: usa `children` para rutas bajo el mismo prefijo (p. ej., `/vagt-flow`, `/shift-planning`, `/recruitment`).

## Archivos
- `types.ts`: tipos `Access` y `RouteConfig`.
- `pages.ts`: imports `lazy` de todas las páginas.
- `guards.tsx`: `PageLoader`, `AuthRoute`, `SmartRedirect` y `wrapWithGuard`.
- `config.tsx`: configuración de rutas agrupada y anidada.
- `AppRouter.tsx`: transforma `RouteConfig[]` a `RouteObject[]` con `useRoutes`.

## Añadir una nueva ruta
1. Exporta la página en `pages.ts`:
   ```ts
   export const Reports = lazyPage(() => import("@/pages/Reports"));
   ```
2. Declara la ruta en `config.tsx`:
   ```ts
   { path: "/reports", component: Reports, access: "role", requireTeamlederOrAbove: true }
   ```
   - Para empleado autenticado:
     ```ts
     { path: "/my-reports", component: Reports, access: "protected" }
     ```
   - Para público:
     ```ts
     { path: "/public-reports", component: Reports, access: "public" }
     ```
   - Para owner-only:
     ```ts
     { path: "/admin/reports", component: Reports, access: "role", requiredRole: "ejer" }
     ```
3. Si es parte de un módulo anidado:
   ```ts
   {
     path: "/recruitment",
     component: RecruitmentDashboard,
     access: "role",
     requireTeamlederOrAbove: true,
     children: [
       { path: "reports", component: Reports, access: "role", requireTeamlederOrAbove: true }
     ]
   }
   ```

## Notas
- `SmartRedirect` define el redireccionamiento inicial según el rol y se asigna a `/`.
- No es necesario editar `App.tsx`; el enrutado se compone automáticamente desde `config.tsx`.

