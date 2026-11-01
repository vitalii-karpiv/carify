import type { ZodType } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import type { CreateResult } from "@/lib/data/entries";

export function unauthenticated(): Response {
  return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
}

export function validationError(issues: unknown[]): Response {
  return Response.json({ error: "VALIDATION", issues }, { status: 422 });
}

export function toCreateResponse(result: CreateResult): Response {
  switch (result.status) {
    case "created":
      return Response.json({ ok: true }, { status: 201 });
    case "duplicate":
      return Response.json({ ok: true, duplicate: true }, { status: 200 });
    case "conflict":
      return Response.json({ error: "ID_CONFLICT" }, { status: 409 });
    case "vehicle_not_found":
      return Response.json({ error: "VEHICLE_NOT_FOUND" }, { status: 404 });
    case "odometer_out_of_range":
      return Response.json(
        { error: "ODOMETER_OUT_OF_RANGE", min: result.min, max: result.max },
        { status: 422 },
      );
  }
}

export async function handleCreate<T>(
  request: Request,
  schema: ZodType<T>,
  create: (userId: string, input: T) => Promise<CreateResult>,
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return validationError([]);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return validationError(parsed.error.issues);
  return toCreateResponse(await create(user.id, parsed.data));
}
