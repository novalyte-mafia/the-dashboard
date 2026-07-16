import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const csvPath = process.argv[2] || "/Users/jamilyakasai/Downloads/5k-accounts.csv";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim()));
}

const TIMEZONES = {
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  AZ: "America/Phoenix", CO: "America/Denver", ID: "America/Denver", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  AL: "America/Chicago", AR: "America/Chicago", IA: "America/Chicago", IL: "America/Chicago", KS: "America/Chicago", LA: "America/Chicago", MN: "America/Chicago", MO: "America/Chicago", MS: "America/Chicago", ND: "America/Chicago", NE: "America/Chicago", OK: "America/Chicago", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
};
const US_STATES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);

function timezoneFor(state) { return TIMEZONES[state] || "America/New_York"; }
function cleanPhone(value) {
  const digits = (value || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : null;
}
function cleanEmail(value) {
  const email = (value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.(jpe?g|png|gif|webp)$/i.test(email) ? email : null;
}
function id(prefix) { return `${prefix}_${randomUUID()}`; }
async function insertChunks(table, rows, size = 250) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table} batch ${i / size + 1}: ${error.message}`);
    console.log(`${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}
async function getExistingExternalIds() {
  const ids = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("prospect_clinics").select("externalId").not("externalId", "is", null).range(from, from + 999);
    if (error) throw error;
    for (const row of data || []) ids.add(row.externalId);
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function main() {
  const parsed = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const headers = parsed.shift().map((header) => header.trim());
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const existing = await getExistingExternalIds();
  const clinics = [], locations = [], profiles = [];
  let invalid = 0, duplicates = 0;

  for (const values of parsed) {
    const get = (name) => (values[index[name]] || "").trim();
    const externalId = get("google_place_id");
    const name = get("name"), city = get("city"), state = get("state").toUpperCase();
    if (!externalId || !name || !city || !state) { invalid++; continue; }
    if (existing.has(externalId)) { duplicates++; continue; }
    existing.add(externalId);
    const clinicId = id("clinic");
    const phone = cleanPhone(get("phone"));
    const validLocation = US_STATES.has(state);
    const website = get("website") || null;
    const readinessScore = (phone ? 10 : 0) + (website ? 12 : 0);
    const timezone = timezoneFor(state);
    clinics.push({
      id: clinicId, externalId, name, website, primaryPhone: phone, generalEmail: cleanEmail(get("email")),
      address: get("street") || null, city, state, zip: get("zip") || null, timezone,
      clinicType: "private_practice", pipelineStage: phone && validLocation ? "ready_to_call" : "needs_research",
      priority: Number(get("affluence_score") || 0) >= 90 ? "high" : "normal", readinessScore,
      directoryStatus: "imported", qualification: "{}",
      notes: `Source: 5k-accounts.csv. Type: ${get("type") || "N/A"}. Vertical: ${get("vertical") || "N/A"}. Services: ${get("services") || "N/A"}. Market: ${get("market") || "N/A"}. Affluence: ${get("affluence_score") || "N/A"}. Google rating: ${get("rating") || "N/A"} (${get("reviews") || 0} reviews). ${validLocation ? "Timezone inferred from state." : "Address columns need manual review; excluded from calling queue."}`,
    });
    locations.push({ id: id("location"), clinicId, label: "Main Location", address: get("street") || null, city, state, zip: get("zip") || null, phone, timezone, isPrimary: true });
    profiles.push({ id: id("directory"), clinicId, listingStatus: "imported", claimStatus: "unclaimed", verificationStatus: "pending", profileCompleteness: website && phone ? 20 : 10, publicationStatus: "draft" });
  }

  const batchId = id("import");
  const adminResult = await supabase.from("admin_members").select("id").eq("status", "active").limit(1).maybeSingle();
  const { error: batchError } = await supabase.from("prospect_import_batches").insert({ id: batchId, fileName: path.basename(csvPath), importedById: adminResult.data?.id || null, totalRows: parsed.length, status: "processing" });
  if (batchError) throw batchError;
  try {
    await insertChunks("prospect_clinics", clinics);
    await insertChunks("prospect_locations", locations);
    await insertChunks("prospect_directory_profiles", profiles);
    const { error } = await supabase.from("prospect_import_batches").update({ successfulRows: clinics.length, failedRows: invalid, duplicateRows: duplicates, status: invalid ? "partial" : "completed", errorReport: invalid ? JSON.stringify([{ error: `${invalid} invalid rows` }]) : "[]" }).eq("id", batchId);
    if (error) throw error;
  } catch (error) {
    await supabase.from("prospect_import_batches").update({ successfulRows: 0, failedRows: parsed.length - duplicates, duplicateRows: duplicates, status: "failed", errorReport: JSON.stringify([{ error: error.message }]) }).eq("id", batchId);
    throw error;
  }
  console.log(JSON.stringify({ total: parsed.length, imported: clinics.length, duplicates, invalid, batchId }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
