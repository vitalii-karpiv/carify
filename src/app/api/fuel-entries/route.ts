import { createFuelEntry } from "@/lib/data/entries";
import { fuelEntryInputSchema } from "@/lib/domain/schemas";
import { handleCreate } from "../_lib/responses";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleCreate(request, fuelEntryInputSchema, createFuelEntry);
}
