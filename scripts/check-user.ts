
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = "josep@bookfast.es";
    console.log(`Checking data for ${email}...`);

    // 1. Get User ID (Service Role can access auth.admin or just use the email if tables allow)
    // We'll list users via auth api
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error("Error listing users:", userError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error("User not found in auth.users");
        return;
    }

    console.log(`User Found: ${user.id} (${user.email})`);

    // 2. Check Memberships
    const { data: memberships, error: membError } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user.id);

    if (membError) {
        console.error("Error fetching memberships:", membError);
        return;
    }

    console.log(`Memberships found: ${memberships.length}`);
    console.table(memberships);

    if (memberships.length === 0) {
        console.warn("User has NO memberships!");
        return;
    }

    // 3. Check Tenants for each membership
    for (const m of memberships) {
        const { data: tenant, error: tenantError } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", m.tenant_id)
            .single();

        if (tenantError) {
            console.error(`Error fetching tenant ${m.tenant_id}:`, tenantError);
        } else {
            console.log(`Tenant ${m.tenant_id}:`);
            console.log(tenant);
        }
    }
}

checkUser();
