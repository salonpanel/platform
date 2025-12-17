import { Suspense } from "react";
import DashboardDataWrapper from "./DashboardDataWrapper";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

export default async function PanelHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const impersonateOrgId = (resolvedSearchParams?.impersonate as string) || null;

  // Layer 2: Server Streaming
  // The Shell (Client Wrapper potentially) is around this, but here we provide the content.
  // We suspend ONLY the data loading part.

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardDataWrapper impersonateOrgId={impersonateOrgId} />
    </Suspense>
  );
}
