import { PageTransition } from "@/components/transitions/PageTransition";

export default function PanelTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
