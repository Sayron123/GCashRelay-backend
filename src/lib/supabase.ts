import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}


//Server-Side Supabase client using the service_role key - bypasses RLS.
//Only import this in backend code. Never expose the key to the android app
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
});