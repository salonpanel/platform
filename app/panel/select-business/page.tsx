import { createClientForServer } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import SelectBusinessClient from "./client";

export default async function SelectBusinessPage() {
    const supabase = await createClientForServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all memberships with tenant details
    const { data: memberships } = await supabase
        .from("memberships")
        .select("tenant_id, tenants(id, name, slug)")
        .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
        redirect("/panel/sin-permisos");
    }

    if (memberships.length === 1) {
        redirect("/panel"); // Auto-select handled by layout usually, but safe here too
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-bold text-white">Selecciona tu negocio</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Tienes acceso a {memberships.length} organizaciones
                    </p>
                </div>
                <div className="mt-8 space-y-4">
                    <SelectBusinessClient memberships={memberships} />
                </div>
            </div>
        </div>
    );
}
