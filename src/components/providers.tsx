"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { IconContext } from "@phosphor-icons/react";
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 45_000,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <IconContext.Provider value={{ "aria-hidden": true, size: 20 }}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </IconContext.Provider>
    </QueryClientProvider>
  );
}
