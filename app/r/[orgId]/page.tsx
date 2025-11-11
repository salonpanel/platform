import { supabaseServer } from "@/lib/supabase";
import { ReserveClient, PublicService } from "./ReserveClient";

type Props = {
  params: { orgId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = "force-dynamic";

export default async function ReservePage({ params, searchParams }: Props) {
  const supabase = supabaseServer();

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_min, price_cents, stripe_price_id")
    .eq("org_id", params.orgId)
    .eq("active", true)
    .order("name");

  let successAppointment: { id: string; status: string } | null = null;
  const appointmentId =
    typeof searchParams?.appointment === "string"
      ? searchParams?.appointment
      : Array.isArray(searchParams?.appointment)
      ? searchParams?.appointment[0]
      : undefined;

  const success = searchParams?.success === "1";

  if (success && appointmentId) {
    const { data } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (data) {
      successAppointment = data;
    }
  }

  const publicServices = (services ?? []) as PublicService[];

  return (
    <ReserveClient
      orgId={params.orgId}
      services={publicServices}
      successAppointment={successAppointment}
    />
  );
}

