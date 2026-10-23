import React, { Suspense } from "react";
import { useRoutes, RouteObject } from "react-router-dom";
import { routes } from "./config";
import type { RouteConfig } from "./types";
import { wrapWithGuard } from "./guards";
import { RouteSkeleton } from "@/components/mobile/Skeletons";

function toRouteObjects(configs: RouteConfig[]): RouteObject[] {
  return configs.map((cfg) => {
    const element = wrapWithGuard(cfg.component, cfg);
    const route: RouteObject = {
      path: cfg.path,
      element,
      children: cfg.children ? toRouteObjects(cfg.children) : undefined,
    };
    return route;
  });
}

export function AppRouter() {
  const routeObjects = toRouteObjects(routes);
  const element = useRoutes(routeObjects);
  return <Suspense fallback={<RouteSkeleton />}>{element}</Suspense>;
}

