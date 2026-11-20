import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently delete the signed-in merchant's login. Their shop is unpublished first so customers no longer see it. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member, error } = await supabase
      .from("business_members")
      .select("role")
      .eq("business_id", data.businessId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !member) throw new Error("You are not a member of this shop.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (member.role === "owner") {
      await supabaseAdmin.from("businesses").update({ is_published: false }).eq("id", data.businessId);
    }
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error("Could not delete the account. Please try again.");
    return { ok: true };
  });
