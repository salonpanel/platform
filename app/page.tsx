import { redirect } from "next/navigation";

export default function Home() {
  // Fix Bug 1: Unconditional, immediate redirect to login.
  // This prevents any async hanging or conditional logic issues on the root domain.
  redirect("/login");
}
