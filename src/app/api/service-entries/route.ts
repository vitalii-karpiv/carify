import { createServiceEntry } from "@/lib/data/entries";
import { serviceEntryInputSchema } from "@/lib/domain/schemas";
import { handleCreate } from "../_lib/responses";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleCreate(request, serviceEntryInputSchema, createServiceEntry);
}
