import { v7 as uuidv7 } from "uuid";
import { beforeEach, describe, expect, it } from "vitest";
import { createFuelEntry, createServiceEntry } from "./entries";
import { listEntryVehicles } from "./entry-vehicles";
import { createTestUser, resetDb } from "./test-utils";
import { createVehicle, setVehicleArchived } from "./vehicles";

const vInput = {
  name: "Daily",
  make: "Toyota",
  model: "Corolla",
  year: 2020,
  plate: "AA0001AA",
  vin: null,
  defaultGrade: "A95" as const,
};

beforeEach(resetDb);

describe("listEntryVehicles", () => {
  it("excludes archived, scopes by user, uses max odometer across both tables and the latest station", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const v1 = await createVehicle(a.id, vInput);
    const v2 = await createVehicle(a.id, { ...vInput, name: "Old" });
    const v3 = await createVehicle(a.id, {
      ...vInput,
      name: "Empty",
      defaultGrade: "DIESEL",
    });
    await createVehicle(b.id, { ...vInput, name: "Other" });
    await setVehicleArchived(a.id, v2.id, true);
    await createFuelEntry(a.id, {
      id: uuidv7(),
      vehicleId: v1.id,
      date: new Date("2026-01-10T10:00:00Z"),
      odometer: 1000,
      litres: 40,
      pricePerLitreKop: 5000,
      totalKop: 200000,
      grade: "A95",
      isFull: true,
      missedPrevious: false,
      station: "WOG",
      note: null,
    });
    // later fill without a station, then an earlier one at OKKO: the latest *recorded* station wins
    await createFuelEntry(a.id, {
      id: uuidv7(),
      vehicleId: v1.id,
      date: new Date("2026-01-12T10:00:00Z"),
      odometer: 1600,
      litres: 10,
      pricePerLitreKop: 5000,
      totalKop: 50000,
      grade: "A95",
      isFull: false,
      missedPrevious: false,
      station: null,
      note: null,
    });
    await createFuelEntry(a.id, {
      id: uuidv7(),
      vehicleId: v1.id,
      date: new Date("2026-01-05T10:00:00Z"),
      odometer: 500,
      litres: 10,
      pricePerLitreKop: 5000,
      totalKop: 50000,
      grade: "A95",
      isFull: false,
      missedPrevious: false,
      station: "OKKO",
      note: null,
    });
    await createServiceEntry(a.id, {
      id: uuidv7(),
      vehicleId: v1.id,
      date: new Date("2026-01-11T10:00:00Z"),
      odometer: 1500,
      category: "OIL_CHANGE",
      totalKop: 100,
      garage: null,
      notes: null,
    });
    const list = await listEntryVehicles(a.id);
    expect(list).toEqual([
      { id: v1.id, name: "Daily", defaultGrade: "A95", lastOdometer: 1600, lastStation: "WOG" },
      { id: v3.id, name: "Empty", defaultGrade: "DIESEL", lastOdometer: null, lastStation: null },
    ]);
  });
});
