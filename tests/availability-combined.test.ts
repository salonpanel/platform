/**
 * Tests para GET /api/availability/combined
 * Valida parámetros y flujos básicos con mocks
 */
import { GET as availabilityCombinedGET } from "../app/api/availability/combined/route";

jest.mock("@/lib/supabase/admin", () => {
  return {
    getSupabaseAdmin: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      rpc: async () => ({ data: [], error: null }),
    }),
  };
});

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

describe("GET /api/availability/combined", () => {
  it("devuelve 400 si faltan parámetros", async () => {
    const res = await availabilityCombinedGET(makeRequest("http://localhost/api/availability/combined"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("devuelve 404 si tenant no existe (por id o slug)", async () => {
    const res = await availabilityCombinedGET(
      makeRequest("http://localhost/api/availability/combined?tenantId=nope&day=2024-01-01")
    );
    expect(res.status).toBe(404);
  });
});









