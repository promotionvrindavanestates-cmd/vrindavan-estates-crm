import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rxfopkfocniynlyijpox.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_V4pq11-uAuTzySbBv-q9pg_RGvGbet4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const subscribeToRealtime = (tableName, callback) => {
  console.log(`[Realtime] Initializing subscription to table: ${tableName}`);
  const channel = supabase
    .channel(`${tableName}-realtime-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        console.log(`[Realtime Event] Table: ${tableName} | Event: ${payload.eventType}`, payload);
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime Status] Table: ${tableName} | Status: ${status}`);
    });

  return channel;
};
