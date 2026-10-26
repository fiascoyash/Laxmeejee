import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LegacyApp = lazy(() => import("@/legacy/Root"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hisaaboo — Smart Billing & Business Management" },
      {
        name: "description",
        content:
          "Hisaaboo helps Indian businesses manage invoices, quotations, payments, customers, suppliers and GST records in one simple platform.",
      },
      { property: "og:title", content: "Hisaaboo — Smart Billing & Business Management" },
      {
        property: "og:description",
        content:
          "Manage invoices, quotations, payments, customers, suppliers and GST records in one simple platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <Suspense fallback={<div className="min-h-screen" />}>
        <LegacyApp />
      </Suspense>
    </ClientOnly>
  );
}
