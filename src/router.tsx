import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { retryDelay, retryTransient } from "./lib/retry";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: retryTransient, retryDelay },
      // Writes are never replayed automatically.
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
