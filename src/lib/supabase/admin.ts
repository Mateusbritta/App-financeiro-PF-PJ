import { createClient } from '@supabase/supabase-js';

/** Cliente com poderes totais. Usar SOMENTE no servidor (rotina de avisos). */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
