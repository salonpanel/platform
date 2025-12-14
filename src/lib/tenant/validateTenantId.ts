/**
 * Tenant ID Validation Utilities
 * 
 * Provides strict validation for tenant_id values to prevent queries
 * from executing with null, undefined, or invalid tenant identifiers.
 * 
 * This is the single source of truth for tenant_id validation across
 * the entire application.
 */

/**
 * Validates that a tenant_id is ready for use in queries
 * 
 * Returns true if tenant_id is a non-empty string that is not "null", "undefined", etc.
 * Returns false and logs warning (dev only) if invalid
 * 
 * @param tenantId - The tenant_id to validate
 * @param caller - Name of the calling function (for logging)
 * @returns Type guard confirming tenantId is a valid string
 * 
 * @example
 * ```ts
 * export async function fetchCustomers(tenantId: string | null) {
 *   if (!validateTenantId(tenantId, "fetchCustomers")) {
 *     return [];
 *   }
 *   // tenantId is now guaranteed to be a valid string
 *   const { data } = await supabase.from("customers").eq("tenant_id", tenantId);
 *   return data || [];
 * }
 * ```
 */
export function validateTenantId(
    tenantId: string | null | undefined,
    caller: string = "unknown"
): tenantId is string {
    // Strict validation - all invalid cases
    const isValid =
        tenantId !== null &&
        tenantId !== undefined &&
        typeof tenantId === "string" &&
        tenantId.trim() !== "" &&
        tenantId !== "null" &&
        tenantId !== "undefined";

    // Dev-only warning for blocked queries
    if (!isValid && process.env.NODE_ENV === "development") {
        console.warn(`[${caller}] ⚠️ BLOCKED: Invalid tenantId`, {
            tenantId,
            type: typeof tenantId,
            value: String(tenantId)
        });
    }

    return isValid;
}

/**
 * Validates and logs execution for tenant-dependent queries
 * 
 * Use at the start of any function that queries with tenant_id.
 * Combines validation with execution logging for better debugging.
 * 
 * @param tenantId - The tenant_id to validate
 * @param caller - Name of the calling function (for logging)
 * @returns Type guard confirming tenantId is a valid string
 * 
 * @example
 * ```ts
 * export async function fetchStaff(tenantId: string | null) {
 *   if (!guardTenantQuery(tenantId, "fetchStaff")) {
 *     return [];
 *   }
 *   
 *   // Query proceeds - dev logs will show:
 *   // [fetchStaff] 🚀 Executing query with tenantId: abc-123
 *   const { data } = await supabase.from("staff").eq("tenant_id", tenantId);
 *   
 *   // Log results
 *   logTenantQueryResult(data?.length || 0, "fetchStaff");
 *   
 *   return data || [];
 * }
 * ```
 */
export function guardTenantQuery(
    tenantId: string | null | undefined,
    caller: string = "unknown"
): tenantId is string {
    // First validate
    if (!validateTenantId(tenantId, caller)) {
        return false;
    }

    // Log execution (dev only)
    if (process.env.NODE_ENV === "development") {
        console.log(`[${caller}] 🚀 Executing query with tenantId:`, tenantId);
    }

    return true;
}

/**
 * Logs the result of a tenant query (dev only)
 * 
 * Call after query execution to track how many rows were returned.
 * Helps identify when queries succeed but return unexpected empty results.
 * 
 * @param rowCount - Number of rows returned by the query
 * @param caller - Name of the calling function
 * @param metadata - Optional additional metadata to log
 * 
 * @example
 * ```ts
 * const { data } = await supabase.from("staff").eq("tenant_id", tenantId);
 * logTenantQueryResult(data?.length || 0, "fetchStaff", { 
 *   staffNames: data?.map(s => s.name) 
 * });
 * ```
 */
export function logTenantQueryResult(
    rowCount: number,
    caller: string = "unknown",
    metadata?: Record<string, any>
): void {
    if (process.env.NODE_ENV !== "development") {
        return;
    }

    console.log(`[${caller}] ✅ Query succeeded:`, {
        rowsReturned: rowCount,
        ...metadata
    });
}

/**
 * Validates a tenant object has a valid ID
 * 
 * Use when receiving a tenant object (not just ID string) to ensure
 * the ID property exists and is valid before using it in queries.
 * 
 * @param tenant - Tenant object to validate
 * @param caller - Name of the calling function
 * @returns Type guard confirming tenant has valid id
 * 
 * @example
 * ```ts
 * export async function fetchAgendaData(tenant: { id?: string; name?: string }) {
 *   if (!validateTenantObject(tenant, "fetchAgendaData")) {
 *     return null;
 *   }
 *   
 *   // tenant.id is now guaranteed to be a valid string
 *   const { data } = await supabase.from("bookings").eq("tenant_id", tenant.id);
 *   return data;
 * }
 * ```
 */
export function validateTenantObject(
    tenant: { id?: string | null } | null | undefined,
    caller: string = "unknown"
): tenant is { id: string } {
    if (!tenant || !tenant.id) {
        if (process.env.NODE_ENV === "development") {
            console.warn(`[${caller}] ⚠️ BLOCKED: Invalid tenant object`, {
                tenant,
                hasId: !!tenant?.id
            });
        }
        return false;
    }

    return validateTenantId(tenant.id, caller);
}
