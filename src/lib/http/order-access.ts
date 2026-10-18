import { cookies } from "next/headers";
import { getCurrentUser } from "./session";

/** Who is looking at an order: the signed-in customer and/or the guest access token minted at checkout (HTTP-only cookie). */
export async function viewerFromCookies(orderNumber: string): Promise<{ userId: string | null; token: string | null }> {
  const u = await getCurrentUser();
  const raw = (await cookies()).get("vr_order_access")?.value ?? "";
  const [num, token] = raw.split(".");
  return { userId: u?.kind === "customer" ? u.id : null, token: num === orderNumber && token ? token : null };
}
