// Typed view of the shop tables until the generated Supabase types include them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "./db-types";

export const db = supabase as unknown as SupabaseClient<Database>;
