import { getSessionUser } from "@/lib/auth/session";
import { getOfflineSnapshot } from "@/lib/data/snapshot";
import { unauthenticated } from "../_lib/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  return Response.json({ vehicles: await getOfflineSnapshot(user.id) });
}
