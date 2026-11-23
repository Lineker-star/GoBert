import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
);

export type Provider = {
  id: string;
  display_name: string;
  city_id: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  accepts_direct_calls: boolean | null;
  is_online: boolean | null;
  last_location: { lat: number; lng: number } | null;
  last_seen_at: string | null;
  service?: string;
};

export type SavedPlace = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  address: string | null;
};

const BERTOUA = { lat: 4.5774, lng: 13.6846 };

export { BERTOUA };
