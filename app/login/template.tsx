import { PageTransition } from "@/components/transitions/PageTransition";

export default function LoginTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
