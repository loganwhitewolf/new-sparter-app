/**
 * Onboarding gate per D-11:
 * - proxy.ts forwards 'x-pathname' on every request (session-only, no DB in edge runtime)
 * - This RSC layout reads the pathname and redirects users with 0 transactions to /onboarding
 * - /onboarding and /settings/* are exempt from the redirect guard
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { AppShell } from "@/components/layout/app-shell";
import { verifySession } from "@/lib/dal/auth";
import { getTransactionCount } from "@/lib/dal/transactions";
import { getOnboardingCompletedAt } from "@/lib/dal/users";
import { APP_ROUTES } from "@/lib/routes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, email, name, image } = await verifySession();

  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";

  // Exempt /onboarding, /settings/*, /import/*, /tags, and /patterns from the zero-transaction
  // redirect guard. /import is part of the data-ingestion flow (including the format-wizard
  // reached from step 1). /tags and /patterns moved out from under /settings/* and need the
  // same exemption they had while nested there.
  const isExempt =
    pathname.startsWith(APP_ROUTES.onboarding) ||
    pathname.startsWith(APP_ROUTES.settings) ||
    pathname.startsWith(APP_ROUTES.import) ||
    pathname.startsWith(APP_ROUTES.tags) ||
    pathname.startsWith(APP_ROUTES.patterns);
  if (!isExempt) {
    const txCount = await getTransactionCount(userId);
    if (txCount === 0) {
      const completedAt = await getOnboardingCompletedAt(userId);
      if (!completedAt) {
        redirect(APP_ROUTES.onboarding);
      }
    }
  }

  // Bypass app chrome (Sidebar, BottomNav) for onboarding flows:
  // - always on /onboarding/*
  // - on /import/* when ?from=onboarding is present (user reached import wizard from step 1)
  const search = requestHeaders.get("x-search") ?? "";
  const fromParam = new URLSearchParams(search).get("from");
  const isOnboarding =
    pathname.startsWith(APP_ROUTES.onboarding) ||
    (pathname.startsWith(APP_ROUTES.import) && fromParam === "onboarding");
  if (isOnboarding) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppShell user={{ email, name, image }}>{children}</AppShell>
    </SidebarProvider>
  );
}
