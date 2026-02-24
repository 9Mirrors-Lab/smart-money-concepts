import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type GratitudeRow = {
  id: string;
  body: string;
  created_at: string;
};

/** Minimal DB shape for gratitude table so Supabase client types the table. */
export type Database = {
  public: {
    Tables: {
      gratitude: {
        Row: GratitudeRow;
        Insert: { body: string; id?: string; created_at?: string };
        Update: Partial<{ body: string }>;
      };
    };
  };
};

const url =
  process.env.NEXT_PUBLIC_SUPABASE_MARKET_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://127.0.0.1:54321";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function getSupabase() {
  if (!key) {
    throw new Error(
      "Missing Supabase key: set NEXT_PUBLIC_SUPABASE_MARKET_ANON_KEY in .env.local (or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  return createClient<Database>(url, key);
}

let client: SupabaseClient<Database> | null = null;

export function getServerSupabase(): SupabaseClient<Database> {
  if (!client) client = getSupabase();
  return client;
}
