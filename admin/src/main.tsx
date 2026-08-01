import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AppRouter } from "@/app/router";
import "./index.css";

/**
 * Query defaults deliberately differ from the public site.
 * docs/ADMIN_UI_ARCHITECTURE.md §5
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin data changes under you; the public site's 5 minutes is wrong here.
      staleTime: 30_000,
      // Opposite of the public site — returning to a lead board should show
      // current data, not what was there ten minutes ago.
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      // A retried POST can duplicate a lead or a note.
      retry: 0,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
