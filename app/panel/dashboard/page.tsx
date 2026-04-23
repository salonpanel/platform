import { Suspense } from "react";
import DashboardDataWrapper from "../DashboardDataWrapper";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

export default async function PanelDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const impersonateOrgId = (resolvedSearchParams?.impersonate as string) || null;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardDataWrapper impersonateOrgId={impersonateOrgId} />
    </Suspense>
  );
}
