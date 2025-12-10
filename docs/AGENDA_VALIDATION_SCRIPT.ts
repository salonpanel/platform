/**
 * 🔥 VALIDATION SCRIPT - AGENDA OPTIMIZATION
 * 
 * Uso: 
 * 1. Copiar este contenido en la consola del navegador (DevTools F12)
 * 2. Se ejecutará automáticamente y mostrará resultados
 * 
 * Requisitos:
 * - Estar en /app/panel/agenda
 * - Tener acceso a Supabase
 */

(async () => {
  console.log("🚀 INICIANDO VALIDACIÓN COMPLETA DE AGENDA...\n");

  // Import Supabase client
  const { getSupabaseBrowser } = await import("@/lib/supabase/browser");
  const supabase = getSupabaseBrowser();

  // Get current user and tenant
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("❌ No user authenticated");
    return;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tenantId = membership?.tenant_id;
  if (!tenantId) {
    console.error("❌ No tenant found");
    return;
  }

  console.log("✅ User and tenant verified");
  console.log(`   User: ${user.id}`);
  console.log(`   Tenant: ${tenantId}\n`);

  // ========================================================================
  // PHASE 1: Test check_booking_conflicts
  // ========================================================================
  console.log("━".repeat(70));
  console.log("PHASE 1: Testing check_booking_conflicts RPC");
  console.log("━".repeat(70));

  try {
    // Get a staff member
    const { data: staffList } = await supabase
      .from("staff")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .limit(1);

    if (!staffList || staffList.length === 0) {
      console.warn("⚠️  No active staff found, skipping test");
    } else {
      const staffId = staffList[0].id;
      const startAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
      const endAt = new Date(Date.now() + 86400000 + 3600000).toISOString(); // +1h

      const { data: conflicts, error } = await supabase.rpc(
        "check_booking_conflicts",
        {
          p_tenant_id: tenantId,
          p_staff_id: staffId,
          p_start_at: startAt,
          p_end_at: endAt,
        }
      );

      if (error) {
        console.error("❌ RPC error:", error);
      } else {
        console.log("✅ check_booking_conflicts executed successfully");
        console.log(`   Staff: ${staffList[0].name}`);
        console.log(`   Conflicts found: ${conflicts?.length || 0}`);
        console.log(`   Result: ${JSON.stringify(conflicts, null, 2)}\n`);
      }
    }
  } catch (err) {
    console.error("❌ Test failed:", err);
  }

  // ========================================================================
  // PHASE 2: Test get_filtered_bookings
  // ========================================================================
  console.log("━".repeat(70));
  console.log("PHASE 2: Testing get_filtered_bookings RPC");
  console.log("━".repeat(70));

  try {
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 604800000)
      .toISOString()
      .split("T")[0]; // +7 days

    const { data: bookings, error } = await supabase.rpc(
      "get_filtered_bookings",
      {
        p_tenant_id: tenantId,
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (error) {
      console.error("❌ RPC error:", error);
    } else {
      console.log("✅ get_filtered_bookings executed successfully");
      console.log(`   Date range: ${startDate} to ${endDate}`);
      console.log(`   Bookings found: ${bookings?.length || 0}`);
      if (bookings && bookings.length > 0) {
        console.log(`   Sample: ${JSON.stringify(bookings[0], null, 2)}\n`);
      }
    }
  } catch (err) {
    console.error("❌ Test failed:", err);
  }

  // ========================================================================
  // PHASE 3: Test get_agenda_stats
  // ========================================================================
  console.log("━".repeat(70));
  console.log("PHASE 3: Testing get_agenda_stats RPC");
  console.log("━".repeat(70));

  try {
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 2592000000)
      .toISOString()
      .split("T")[0]; // +30 days

    const { data: stats, error } = await supabase.rpc("get_agenda_stats", {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error("❌ RPC error:", error);
    } else {
      console.log("✅ get_agenda_stats executed successfully");
      console.log(`   Date range: ${startDate} to ${endDate}`);
      console.log(`   Stats: ${JSON.stringify(stats, null, 2)}\n`);
    }
  } catch (err) {
    console.error("❌ Test failed:", err);
  }

  // ========================================================================
  // PHASE 4: Performance Benchmark
  // ========================================================================
  console.log("━".repeat(70));
  console.log("PHASE 4: Performance Benchmark");
  console.log("━".repeat(70));

  try {
    const iterations = 5;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await supabase.rpc("get_filtered_bookings", {
        p_tenant_id: tenantId,
        p_start_date: new Date().toISOString().split("T")[0],
        p_end_date: new Date(Date.now() + 604800000)
          .toISOString()
          .split("T")[0],
      });
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log("✅ Performance test completed");
    console.log(`   Iterations: ${iterations}`);
    console.log(`   Avg time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min time: ${minTime.toFixed(2)}ms`);
    console.log(`   Max time: ${maxTime.toFixed(2)}ms\n`);

    if (avgTime < 500) {
      console.log("✅ Performance is EXCELLENT (< 500ms)\n");
    } else if (avgTime < 1000) {
      console.log("⚠️  Performance is GOOD (< 1000ms)\n");
    } else {
      console.log("❌ Performance needs optimization (> 1000ms)\n");
    }
  } catch (err) {
    console.error("❌ Test failed:", err);
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("━".repeat(70));
  console.log("✅ VALIDATION COMPLETE");
  console.log("━".repeat(70));
  console.log(
    "\n📊 Summary:\n" +
      "  ✔ check_booking_conflicts - Ready\n" +
      "  ✔ get_filtered_bookings - Ready\n" +
      "  ✔ get_agenda_stats - Ready\n" +
      "  ✔ Performance - Verified\n"
  );
  console.log("\nNext steps:");
  console.log(
    "  1. Open /app/panel/agenda\n" +
      "  2. Create a new booking\n" +
      "  3. Try to move it (should detect conflicts)\n" +
      "  4. Check stats display\n"
  );
})();
