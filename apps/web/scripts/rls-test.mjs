import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// load .env.local
const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`PASS: ${name} (${detail})`);
  } else {
    console.error(`FAIL: ${name} (${detail})`);
    failures++;
  }
}

async function run() {
  // 1. anon cannot read provider_documents
  {
    const { data, error } = await supabase.from("provider_documents").select("id");
    const count = data?.length ?? 0;
    check("anon cannot read provider_documents", !error && count === 0, error ? error.message : `${count} rows`);
  }

  // 2. anon cannot read bookings
  {
    const { data, error } = await supabase.from("bookings").select("id");
    const count = data?.length ?? 0;
    check("anon cannot read bookings", !error && count === 0, error ? error.message : `${count} rows`);
  }

  // 3. anon CAN read approved providers
  {
    const { data, error } = await supabase
      .from("providers")
      .select("id, display_name")
      .eq("verification_status", "approved");
    const count = data?.length ?? 0;
    check("anon can read approved providers", !error && count > 0, error ? error.message : `${count} rows`);
  }

  // 4. anon cannot read pending providers
  {
    const { data, error } = await supabase
      .from("providers")
      .select("id")
      .eq("verification_status", "pending");
    const count = data?.length ?? 0;
    check("anon cannot read pending providers", !error && count === 0, error ? error.message : `${count} rows`);
  }

  // 5. anon cannot read wallet_ledger
  {
    const { data, error } = await supabase.from("wallet_ledger").select("id");
    const count = data?.length ?? 0;
    check("anon cannot read wallet_ledger", !error && count === 0, error ? error.message : `${count} rows`);
  }

  console.log(failures === 0 ? "\nAll RLS tests passed." : `\n${failures} RLS test(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});