import { v7 as uuidv7 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUser } from "@/lib/auth/session";
import { createTestUser, resetDb } from "@/lib/data/test-utils";
import { createVehicle, setVehicleArchived } from "@/lib/data/vehicles";
import { GET as snapshotGET } from "./offline-snapshot/route";
import { POST as fuelPOST } from "./fuel-entries/route";
import { POST as servicePOST } from "./service-entries/route";

vi.mock("@/lib/auth/session");

const vInput = {
  name: "Daily",
  make: "Toyota",
  model: "Corolla",
  year: 2020,
  plate: "AA0001AA",
  vin: null,
  defaultGrade: "A95" as const,
};

let userId: string;
let vehicleId: string;

beforeEach(async () => {
  await resetDb();
  const u = await createTestUser();
  userId = u.id;
  vehicleId = (await createVehicle(userId, vInput)).id;
  vi.mocked(getSessionUser).mockResolvedValue({
    id: userId,
    email: "x@y.z",
    name: "X",
  });
});

let otherVehicleId: string;

async function switchToOtherUser() {
  const o = await createTestUser();
  otherVehicleId = (await createVehicle(o.id, vInput)).id;
  vi.mocked(getSessionUser).mockResolvedValue({
    id: o.id,
    email: "o@y.z",
    name: "O",
  });
}

const post = (body: unknown) =>
  new Request("http://test/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const fuelBody = (over: Record<string, unknown> = {}) => ({
  id: uuidv7(),
  vehicleId,
  date: "2026-01-10T10:00:00Z",
  odometer: 1000,
  litres: 40,
  pricePerLitreKop: 5000,
  totalKop: 200000,
  grade: "A95",
  isFull: true,
  missedPrevious: false,
  station: null,
  note: null,
  ...over,
});

const serviceBody = (over: Record<string, unknown> = {}) => ({
  id: uuidv7(),
  vehicleId,
  date: "2026-01-10T10:00:00Z",
  odometer: 1000,
  category: "OIL_CHANGE",
  totalKop: 1000,
  garage: null,
  notes: null,
  ...over,
});

describe("POST /api/fuel-entries", () => {
  it("401 without session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const res = await fuelPOST(post(fuelBody()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("422 on malformed JSON", async () => {
    const res = await fuelPOST(post("{nope"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "VALIDATION", issues: [] });
  });

  it("422 on schema violation with issues", async () => {
    const res = await fuelPOST(post(fuelBody({ totalKop: 1 })));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("201 created, then 200 duplicate for identical replay", async () => {
    const b = fuelBody();
    const r1 = await fuelPOST(post(b));
    expect(r1.status).toBe(201);
    expect(await r1.json()).toEqual({ ok: true });
    const r2 = await fuelPOST(post(b));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ok: true, duplicate: true });
  });

  it("409 when the id already belongs to another user", async () => {
    const b = fuelBody();
    await fuelPOST(post(b));
    await switchToOtherUser();
    const res = await fuelPOST(post({ ...b, vehicleId: otherVehicleId }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ID_CONFLICT" });
  });

  it("404 for unknown vehicle", async () => {
    const res = await fuelPOST(post(fuelBody({ vehicleId: uuidv7() })));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "VEHICLE_NOT_FOUND" });
  });

  it("422 ODOMETER_OUT_OF_RANGE with min/max", async () => {
    await fuelPOST(
      post(fuelBody({ odometer: 2000, date: "2026-01-10T10:00:00Z" })),
    );
    const res = await fuelPOST(
      post(fuelBody({ odometer: 1000, date: "2026-01-20T10:00:00Z" })),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("ODOMETER_OUT_OF_RANGE");
    expect(body).toHaveProperty("min");
    expect(body).toHaveProperty("max");
  });
});

describe("POST /api/service-entries", () => {
  it("401 without session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    expect((await servicePOST(post(serviceBody()))).status).toBe(401);
  });

  it("422 on invalid body", async () => {
    const res = await servicePOST(post(serviceBody({ category: "NOPE" })));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("201 then 200 duplicate", async () => {
    const b = serviceBody();
    expect((await servicePOST(post(b))).status).toBe(201);
    const r2 = await servicePOST(post(b));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ok: true, duplicate: true });
  });

  it("409 when the id already belongs to another user", async () => {
    const b = serviceBody();
    await servicePOST(post(b));
    await switchToOtherUser();
    const res = await servicePOST(post({ ...b, vehicleId: otherVehicleId }));
    expect(res.status).toBe(409);
  });

  it("404 for unknown vehicle", async () => {
    const res = await servicePOST(post(serviceBody({ vehicleId: uuidv7() })));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/offline-snapshot", () => {
  it("401 without session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const res = await snapshotGET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("200 with non-archived vehicles and lastOdometer from highest entry", async () => {
    const archived = await createVehicle(userId, { ...vInput, name: "Old" });
    await setVehicleArchived(userId, archived.id, true);
    await servicePOST(post(serviceBody({ odometer: 5000 })));
    await fuelPOST(
      post(fuelBody({ odometer: 4000, date: "2026-01-05T10:00:00Z" })),
    );
    const res = await snapshotGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      vehicles: [
        {
          id: vehicleId,
          name: "Daily",
          defaultGrade: "A95",
          lastOdometer: 5000,
        },
      ],
    });
  });
});
