import { createClient } from "@supabase/supabase-js";

/** Должны совпадать с проектом в dashboard Supabase (Anon / public). */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

// Один инстанс на `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
// 403 при корректном id чаще из‑за RLS, чем из‑за «не той» anon_key — сначала проверь политики для `drawings`.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
