#!/usr/bin/env node
/**
 * Import public clinic prospects discovered via TRT Advisor into prospect_clinics.
 *
 * Modes:
 *   --mode=preview   Discover + parse only (no DB writes)
 *   --mode=dry-run   Classify vs existing DB (no DB writes)
 *   --mode=commit    Insert only "new" records (requires --i-approve-commit)
 *
 * Examples:
 *   node scripts/import-trt-advisor-clinics.mjs --mode=preview
 *   node scripts/import-trt-advisor-clinics.mjs --mode=dry-run
 *   node scripts/import-trt-advisor-clinics.mjs --mode=commit --i-approve-commit
 *
 * Does NOT publish to public "Clinic" directory.
 * Does NOT modify dashboard UI.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import {
  classifyDuplicate,
  formatPhoneDisplay,
  normalizeClinicName,
  normalizePhoneDigits,
  normalizeWebsiteDomain,
  nameCityStateKey,
  normalizeFullAddress,
} from "./lib/clinic-normalize.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(root, file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnv();

const REPORT_DIR = path.join(root, "scripts", "reports");
const CACHE_DIR = path.join(root, ".firecrawl");
const PATHS_CACHE = path.join(CACHE_DIR, "trt-profile-paths.json");
const DISCOVERED_CACHE = path.join(CACHE_DIR, "trt-discovered-clinics.json");

const BASE = "https://clinics.trtadvisor.com";
const UA = "Mozilla/5.0 (compatible; NovalyteResearch/1.0; +https://novalyte.io)";
const BLOCK_HOST_SNIPPETS = [
  "trtadvisor.com",
  "optimizecdn.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "google.com",
  "gstatic.com",
  "fonts.",
  "recaptcha",
  "wonderdads",
  "maps.g",
];

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return true;
  return fallback;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function id(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function extractProfilePaths(html) {
  const paths = new Set(
    (html.match(/\/united-states\/[a-z0-9\-]+\/[a-z0-9\-]+\/[a-z0-9\-]+/g) || []).filter(
      (p) => !p.endsWith("/connect"),
    ),
  );
  return paths;
}

async function discoverProfilePaths({ maxPages = 80, useCache = true } = {}) {
  if (useCache && fs.existsSync(PATHS_CACHE)) {
    const cached = JSON.parse(fs.readFileSync(PATHS_CACHE, "utf8"));
    if (Array.isArray(cached) && cached.length > 0) {
      console.log(`Using cached profile paths (${cached.length})`);
      return cached;
    }
  }

  const all = new Set();
  let stale = 0;
  for (let page = 1; page <= maxPages; page++) {
    const html = await fetchText(`${BASE}/search_results?page=${page}`);
    const paths = extractProfilePaths(html);
    let added = 0;
    for (const p of paths) {
      if (!all.has(p)) {
        all.add(p);
        added++;
      }
    }
    console.log(`discover page ${page}: +${added} (total ${all.size})`);
    if (added === 0) {
      stale++;
      if (stale >= 2) break;
    } else stale = 0;
    await sleep(350);
  }
  const list = [...all].sort();
  fs.writeFileSync(PATHS_CACHE, JSON.stringify(list, null, 2));
  return list;
}

function parseLocalBusiness(html, pathSlug) {
  const sourceUrl = `${BASE}${pathSlug}`;
  const parts = pathSlug.split("/").filter(Boolean);
  const category = parts[2] || null;
  const out = {
    sourceUrl,
    path: pathSlug,
    category,
    name: null,
    phone: null,
    website: null,
    websiteCandidates: [],
    address: null,
    city: null,
    state: null,
    zip: null,
  };

  const blocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const graph = data?.["@graph"];
    if (!Array.isArray(graph)) continue;
    for (const node of graph) {
      if (node?.["@type"] !== "LocalBusiness") continue;
      out.name = node.name || out.name;
      const digits = normalizePhoneDigits(node.telephone);
      if (digits) out.phone = digits;
      const addr = node.address || {};
      out.address = addr.streetAddress || out.address;
      out.city = addr.addressLocality || out.city;
      out.state = addr.addressRegion || out.state;
      out.zip = addr.postalCode || out.zip;
    }
  }

  const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
  const websites = [];
  for (const href of hrefs) {
    const low = href.toLowerCase();
    if (BLOCK_HOST_SNIPPETS.some((b) => low.includes(b))) continue;
    if (low.startsWith("mailto:")) continue;
    const clean = href.split("#")[0].split("?")[0];
    if (!normalizeWebsiteDomain(clean)) continue;
    if (!websites.includes(clean)) websites.push(clean);
  }
  out.websiteCandidates = websites.slice(0, 5);
  out.website = websites[0] || null;

  // City/state from URL when JSON-LD incomplete
  if (!out.city && parts[1]) {
    out.city = parts[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return out;
}

function validateCandidate(rec) {
  if (!rec.name || !String(rec.name).trim()) {
    return { ok: false, reason: "missing_name" };
  }
  // Need at least city+state OR phone OR website to be useful as a prospect
  const hasGeo = Boolean(rec.city && rec.state);
  const hasPhone = Boolean(normalizePhoneDigits(rec.phone));
  const hasWeb = Boolean(normalizeWebsiteDomain(rec.website));
  if (!hasGeo && !hasPhone && !hasWeb) {
    return { ok: false, reason: "missing_essential_contact_or_location" };
  }
  // Skip obvious non-clinic spam categories when present
  if (rec.category === "wrong-industry") {
    return { ok: false, reason: "wrong_industry_category" };
  }
  return { ok: true, reason: null };
}

async function scrapeProfiles(paths, { limit = null, useCache = true } = {}) {
  if (useCache && fs.existsSync(DISCOVERED_CACHE)) {
    const cached = JSON.parse(fs.readFileSync(DISCOVERED_CACHE, "utf8"));
    if (Array.isArray(cached) && cached.length > 0) {
      console.log(`Using cached discovered clinics (${cached.length})`);
      return limit ? cached.slice(0, limit) : cached;
    }
  }

  const selected = limit ? paths.slice(0, limit) : paths;
  const rows = [];
  for (let i = 0; i < selected.length; i++) {
    const p = selected[i];
    try {
      const html = await fetchText(`${BASE}${p}`);
      rows.push(parseLocalBusiness(html, p));
      if ((i + 1) % 10 === 0 || i === selected.length - 1) {
        console.log(`scraped ${i + 1}/${selected.length}`);
      }
    } catch (err) {
      console.warn(`failed ${p}: ${err.message}`);
      rows.push({
        sourceUrl: `${BASE}${p}`,
        path: p,
        name: null,
        scrapeError: err.message,
      });
    }
    await sleep(300);
  }
  fs.writeFileSync(DISCOVERED_CACHE, JSON.stringify(rows, null, 2));
  return rows;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAllProspectClinics(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("prospect_clinics")
      .select("id,name,website,primaryPhone,address,city,state,zip,externalId,archived")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function fetchAllPublicClinics(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("Clinic")
      .select("id,name,website,phone,city,state,zip")
      .is("deletedAt", null)
      .range(from, from + 999);
    if (error) {
      console.warn(`public Clinic read skipped: ${error.message}`);
      return [];
    }
    rows.push(
      ...(data || []).map((r) => ({
        id: r.id,
        name: r.name,
        website: r.website,
        primaryPhone: r.phone,
        phone: r.phone,
        address: null,
        city: r.city,
        state: r.state,
        zip: r.zip,
        _source: "public_Clinic",
      })),
    );
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function buildIndexes(existingRows) {
  const byDomain = new Map();
  const byPhone = new Map();
  const byNameAddr = new Map();
  const byNameCityState = new Map();
  const list = [];

  for (const row of existingRows) {
    const snap = {
      id: row.id,
      name: row.name,
      website: row.website,
      phone: row.primaryPhone || row.phone,
      primaryPhone: row.primaryPhone || row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      _source: row._source || "prospect_clinics",
    };
    list.push(snap);
    const domain = normalizeWebsiteDomain(snap.website);
    if (domain) {
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain).push(snap);
    }
    const phone = normalizePhoneDigits(snap.phone);
    if (phone) {
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone).push(snap);
    }
    const na = `${normalizeClinicName(snap.name)}|${normalizeFullAddress(snap) || ""}`;
    if (!byNameAddr.has(na)) byNameAddr.set(na, []);
    byNameAddr.get(na).push(snap);
    const ncs = nameCityStateKey(snap.name, snap.city, snap.state);
    if (ncs) {
      if (!byNameCityState.has(ncs)) byNameCityState.set(ncs, []);
      byNameCityState.get(ncs).push(snap);
    }
  }
  return { list, byDomain, byPhone, byNameAddr, byNameCityState };
}

function findBestMatch(candidate, indexes, batchSeen) {
  // Check in-batch first
  for (const prev of batchSeen) {
    const hit = classifyDuplicate(candidate, prev);
    if (hit.kind) {
      return { ...hit, matched: { ...prev, id: prev._batchId || prev.id, _source: "import_batch" } };
    }
  }

  const domain = normalizeWebsiteDomain(candidate.website);
  if (domain && indexes.byDomain.has(domain)) {
    const matched = indexes.byDomain.get(domain)[0];
    return { kind: "confirmed", reason: "same_website_domain", confidence: 0.99, matched };
  }
  const phone = normalizePhoneDigits(candidate.phone);
  if (phone && indexes.byPhone.has(phone)) {
    const matched = indexes.byPhone.get(phone)[0];
    return { kind: "confirmed", reason: "same_phone", confidence: 0.98, matched };
  }

  let best = { kind: null, reason: null, confidence: 0, matched: null };
  // Limit full scan to plausible city/state peers when possible
  const peers = indexes.list.filter((e) => {
    if (!candidate.state || !e.state) return true;
    return String(candidate.state).toUpperCase() === String(e.state).toUpperCase();
  });
  const scan = peers.length && peers.length < indexes.list.length ? peers : indexes.list;
  for (const existing of scan) {
    const hit = classifyDuplicate(candidate, existing);
    if (!hit.kind) continue;
    if (hit.kind === "confirmed") return { ...hit, matched: existing };
    if (hit.confidence > best.confidence) best = { ...hit, matched: existing };
  }
  return best;
}

function classifyAll(discovered, indexes) {
  const batchSeen = [];
  const results = {
    new: [],
    confirmed_duplicate: [],
    probable_duplicate: [],
    invalid: [],
    missing_essential: [],
  };

  for (const raw of discovered) {
    const candidate = {
      name: raw.name,
      phone: raw.phone,
      website: raw.website,
      address: raw.address,
      city: raw.city,
      state: raw.state,
      zip: raw.zip,
      sourceUrl: raw.sourceUrl,
      category: raw.category,
      path: raw.path,
    };

    const validation = validateCandidate(candidate);
    if (!validation.ok) {
      const bucket = validation.reason?.startsWith("missing_") ? "missing_essential" : "invalid";
      results[bucket].push({ ...candidate, skipReason: validation.reason });
      continue;
    }

    const match = findBestMatch(candidate, indexes, batchSeen);
    if (match.kind === "confirmed") {
      results.confirmed_duplicate.push({
        ...candidate,
        matchedExistingId: match.matched?.id,
        matchedExistingName: match.matched?.name,
        matchReason: match.reason,
        matchedPhone: match.matched?.primaryPhone || match.matched?.phone || null,
        matchedDomain: normalizeWebsiteDomain(match.matched?.website),
        matchedAddress: [match.matched?.address, match.matched?.city, match.matched?.state]
          .filter(Boolean)
          .join(", "),
        confidence: match.confidence,
        matchedSource: match.matched?._source,
      });
      continue;
    }
    if (match.kind === "probable") {
      results.probable_duplicate.push({
        ...candidate,
        matchedExistingId: match.matched?.id,
        matchedExistingName: match.matched?.name,
        matchReason: match.reason,
        matchedPhone: match.matched?.primaryPhone || match.matched?.phone || null,
        matchedDomain: normalizeWebsiteDomain(match.matched?.website),
        matchedAddress: [match.matched?.address, match.matched?.city, match.matched?.state]
          .filter(Boolean)
          .join(", "),
        confidence: match.confidence,
        matchedSource: match.matched?._source,
      });
      continue;
    }

    const batchId = id("pending");
    batchSeen.push({ ...candidate, id: batchId, _batchId: batchId });
    results.new.push(candidate);
  }

  return results;
}

function writeReports(summary, classified, inserted = []) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(REPORT_DIR, `trt-advisor-import-${stamp}.json`);
  const csvPath = path.join(REPORT_DIR, `trt-advisor-import-${stamp}.csv`);
  const latestJson = path.join(REPORT_DIR, "trt-advisor-import-latest.json");
  const latestCsv = path.join(REPORT_DIR, "trt-advisor-import-latest.csv");

  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    newClinics: classified.new,
    confirmedDuplicates: classified.confirmed_duplicate,
    probableDuplicates: classified.probable_duplicate,
    invalid: classified.invalid,
    missingEssential: classified.missing_essential,
    inserted,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(latestJson, JSON.stringify(payload, null, 2));

  const csvRows = [
    [
      "classification",
      "name",
      "phone",
      "website",
      "city",
      "state",
      "sourceUrl",
      "matchedExistingId",
      "matchedExistingName",
      "matchReason",
      "confidence",
      "newRecordId",
    ].join(","),
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const push = (cls, row, newId = "") => {
    csvRows.push(
      [
        cls,
        row.name,
        row.phone,
        row.website,
        row.city,
        row.state,
        row.sourceUrl,
        row.matchedExistingId,
        row.matchedExistingName,
        row.matchReason || row.skipReason,
        row.confidence,
        newId,
      ]
        .map(esc)
        .join(","),
    );
  };
  for (const r of classified.new) push("new", r);
  for (const r of classified.confirmed_duplicate) push("confirmed_duplicate", r);
  for (const r of classified.probable_duplicate) push("probable_duplicate", r);
  for (const r of classified.invalid) push("invalid", r);
  for (const r of classified.missing_essential) push("missing_essential", r);
  for (const r of inserted) push("inserted", r, r.newRecordId);
  fs.writeFileSync(csvPath, csvRows.join("\n"));
  fs.writeFileSync(latestCsv, csvRows.join("\n"));
  console.log(`Report JSON: ${jsonPath}`);
  console.log(`Report CSV:  ${csvPath}`);
  return { jsonPath, csvPath };
}

async function commitNew(supabase, clinics, existingCountBefore) {
  const inserted = [];
  const failed = [];
  const existingIds = new Set();
  // snapshot IDs
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("prospect_clinics").select("id").range(from, from + 999);
    if (error) throw error;
    for (const row of data || []) existingIds.add(row.id);
    if (!data || data.length < 1000) break;
  }
  fs.writeFileSync(
    path.join(REPORT_DIR, `prospect-clinic-ids-before-${Date.now()}.json`),
    JSON.stringify([...existingIds], null, 2),
  );

  const adminResult = await supabase.from("admin_members").select("id").eq("status", "active").limit(1).maybeSingle();
  const batchId = id("import");
  const { error: batchError } = await supabase.from("prospect_import_batches").insert({
    id: batchId,
    fileName: "trt-advisor-directory",
    importedById: adminResult.data?.id || null,
    totalRows: clinics.length,
    status: "processing",
  });
  if (batchError) throw batchError;

  try {
    for (const c of clinics) {
      const clinicId = id("clinic");
      const phoneDigits = normalizePhoneDigits(c.phone);
      const phone = formatPhoneDisplay(phoneDigits);
      const website = c.website || null;
      const externalId = `trtadvisor:${c.path}`;
      const row = {
        id: clinicId,
        externalId,
        name: c.name.trim(),
        website,
        primaryPhone: phone,
        address: c.address || null,
        city: c.city || null,
        state: c.state ? String(c.state).toUpperCase() : null,
        zip: c.zip || null,
        country: "US",
        timezone: "America/New_York",
        clinicType: "private_practice",
        pipelineStage: phone ? "ready_to_call" : "needs_research",
        priority: "normal",
        readinessScore: (phone ? 10 : 0) + (website ? 12 : 0) + (c.city && c.state ? 8 : 0),
        directoryStatus: "imported",
        qualification: "{}",
        notes: `Source: TRT Advisor public directory. Profile: ${c.sourceUrl}. Category: ${c.category || "n/a"}. Not published to public directory.`,
        archived: false,
      };
      const { error: clinicErr } = await supabase.from("prospect_clinics").insert(row);
      if (clinicErr) {
        failed.push({ ...c, error: clinicErr.message });
        continue;
      }
      await supabase.from("prospect_locations").insert({
        id: id("location"),
        clinicId,
        label: "Main Location",
        address: c.address || null,
        city: c.city || null,
        state: c.state ? String(c.state).toUpperCase() : null,
        zip: c.zip || null,
        phone,
        timezone: "America/New_York",
        isPrimary: true,
      });
      await supabase.from("prospect_directory_profiles").insert({
        id: id("directory"),
        clinicId,
        listingStatus: "imported",
        claimStatus: "unclaimed",
        verificationStatus: "pending",
        profileCompleteness: website && phone ? 20 : 10,
        publicationStatus: "draft",
      });
      inserted.push({
        newRecordId: clinicId,
        name: c.name,
        phone,
        website,
        city: c.city,
        state: c.state,
        sourceUrl: c.sourceUrl,
      });
    }

    await supabase
      .from("prospect_import_batches")
      .update({
        successfulRows: inserted.length,
        failedRows: failed.length,
        duplicateRows: 0,
        status: failed.length ? "partial" : "completed",
        errorReport: JSON.stringify(failed.slice(0, 50)),
      })
      .eq("id", batchId);
  } catch (err) {
    await supabase
      .from("prospect_import_batches")
      .update({ status: "failed", errorReport: JSON.stringify([{ error: err.message }]) })
      .eq("id", batchId);
    throw err;
  }

  const { count } = await supabase
    .from("prospect_clinics")
    .select("id", { count: "exact", head: true });

  return {
    inserted,
    failed,
    existingCountBefore,
    clinicCountAfter: count ?? existingCountBefore + inserted.length,
    batchId,
  };
}

async function main() {
  ensureDirs();
  const mode = String(arg("mode", "preview")).toLowerCase();
  const limit = arg("limit") ? Number(arg("limit")) : null;
  const refresh = Boolean(arg("refresh", false));
  const approve = Boolean(arg("i-approve-commit", false));

  console.log(`Mode: ${mode}`);

  const paths = await discoverProfilePaths({ useCache: !refresh });
  const discovered = await scrapeProfiles(paths, { limit, useCache: !refresh && !limit });

  if (mode === "preview") {
    const valid = discovered.filter((d) => validateCandidate(d).ok);
    const invalid = discovered.filter((d) => !validateCandidate(d).ok);
    const summary = {
      mode: "preview",
      totalProfilesDiscovered: paths.length,
      totalScraped: discovered.length,
      totalValidClinics: valid.length,
      totalInvalidOrIncomplete: invalid.length,
      note: "No database comparison or writes performed.",
    };
    writeReports(summary, {
      new: valid,
      confirmed_duplicate: [],
      probable_duplicate: [],
      invalid: invalid.filter((d) => validateCandidate(d).reason && !validateCandidate(d).reason.startsWith("missing_")),
      missing_essential: invalid.filter((d) => validateCandidate(d).reason?.startsWith("missing_")),
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (mode !== "dry-run" && mode !== "commit") {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const supabase = getSupabase();
  const prospectRows = await fetchAllProspectClinics(supabase);
  const publicRows = await fetchAllPublicClinics(supabase);
  const existingCountBefore = prospectRows.length;
  console.log(`Existing prospect_clinics: ${existingCountBefore}`);
  console.log(`Public Clinic rows loaded: ${publicRows.length}`);

  const indexes = buildIndexes([
    ...prospectRows.map((r) => ({ ...r, _source: "prospect_clinics" })),
    ...publicRows,
  ]);
  const classified = classifyAll(discovered, indexes);

  const summary = {
    mode,
    totalProfilesDiscovered: paths.length,
    totalScraped: discovered.length,
    totalValidClinics:
      classified.new.length +
      classified.confirmed_duplicate.length +
      classified.probable_duplicate.length,
    totalNewClinics: classified.new.length,
    totalConfirmedDuplicates: classified.confirmed_duplicate.length,
    totalProbableDuplicates: classified.probable_duplicate.length,
    totalInvalidRecords: classified.invalid.length,
    totalMissingEssential: classified.missing_essential.length,
    totalInserted: 0,
    totalSkipped:
      classified.confirmed_duplicate.length +
      classified.probable_duplicate.length +
      classified.invalid.length +
      classified.missing_essential.length,
    totalFailed: 0,
    existingClinicCountBefore: existingCountBefore,
    clinicCountAfter: existingCountBefore,
  };

  if (mode === "dry-run") {
    writeReports(summary, classified);
    console.log(JSON.stringify(summary, null, 2));
    console.log("Dry-run complete. No records inserted.");
    return;
  }

  // commit
  if (!approve) {
    throw new Error("Commit mode refused: pass --i-approve-commit after reviewing the dry-run report.");
  }

  const commitResult = await commitNew(supabase, classified.new, existingCountBefore);
  summary.totalInserted = commitResult.inserted.length;
  summary.totalFailed = commitResult.failed.length;
  summary.clinicCountAfter = commitResult.clinicCountAfter;
  summary.batchId = commitResult.batchId;
  writeReports(summary, classified, commitResult.inserted);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
