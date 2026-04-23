import { PageTransition } from "@/components/transitions/PageTransition";

export default function TenantPublicTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
