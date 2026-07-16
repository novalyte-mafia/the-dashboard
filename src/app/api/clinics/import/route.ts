import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import fs from "fs";
import crypto from "crypto";

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let insideQuote = false;
  let entry = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(entry.trim());
      entry = "";
    } else {
      entry += char;
    }
  }
  result.push(entry.trim());
  return result;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const dryRun = Boolean(body.dryRun);
  const filePath = "/Users/jamilyakasai/Downloads/5k-accounts.csv";

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "CSV file not found in Downloads folder" }, { status: 404 });
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const fileHash = crypto.createHash("sha256").update(fileContent).digest("hex");

  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headers = parseCSVLine(lines[0]);

  const nameIdx = headers.indexOf("name");
  const typeIdx = headers.indexOf("type");
  const verticalIdx = headers.indexOf("vertical");
  const streetIdx = headers.indexOf("street");
  const cityIdx = headers.indexOf("city");
  const stateIdx = headers.indexOf("state");
  const zipIdx = headers.indexOf("zip");
  const phoneIdx = headers.indexOf("phone");
  const emailIdx = headers.indexOf("email");
  const websiteIdx = headers.indexOf("website");
  const ratingIdx = headers.indexOf("rating");
  const reviewsIdx = headers.indexOf("reviews");
  const servicesIdx = headers.indexOf("services");
  const marketIdx = headers.indexOf("market");
  const affluenceIdx = headers.indexOf("affluence_score");
  const statusIdx = headers.indexOf("crm_status");
  const placeIdIdx = headers.indexOf("google_place_id");

  let totalRows = lines.length - 1;
  let successfulRows = 0;
  let duplicateRows = 0;
  let failedRows = 0;
  const errors: any[] = [];

  // Create an import batch entry
  let batch: { id: string } | null = null;
  if (!dryRun) {
    batch = await db.clinicImport.create({
      data: {
        fileName: "5k-accounts.csv",
        importedById: admin.id,
        totalRows,
        status: "processing",
        errorReport: "[]"
      }
    });
  }

  // Iterate over each data row
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < headers.length) {
      failedRows++;
      errors.push({ row: i, error: "Row has fewer columns than header" });
      continue;
    }

    const name = cols[nameIdx];
    const type = cols[typeIdx] || "private_practice";
    const vertical = cols[verticalIdx];
    const street = cols[streetIdx];
    const city = cols[cityIdx];
    const state = cols[stateIdx];
    const zip = cols[zipIdx];
    const phone = cols[phoneIdx];
    const email = cols[emailIdx];
    const website = cols[websiteIdx];
    const rating = parseFloat(cols[ratingIdx] || "0");
    const reviews = parseInt(cols[reviewsIdx] || "0", 10);
    const servicesText = cols[servicesIdx];
    const market = cols[marketIdx];
    const affluence = parseInt(cols[affluenceIdx] || "0", 10);
    const placeId = cols[placeIdIdx];

    if (!name || !city || !state) {
      failedRows++;
      errors.push({ row: i, error: `Row missing name, city, or state: ${name || 'N/A'}` });
      continue;
    }

    // Phone number format normalization (e.g. (650) 815-2137)
    let formattedPhone = phone || null;
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length === 10) {
        formattedPhone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
    }

    // Email field filter (check if it is actually an image name like "drHornBio@1.2x.jpg")
    let cleanEmail = email || null;
    if (email && (email.endsWith(".jpg") || email.endsWith(".png") || email.endsWith(".jpeg"))) {
      cleanEmail = null;
    }

    // Check duplicate by external google_place_id or unique name+address
    let existing = null;
    if (placeId) {
      existing = await db.clinic.findFirst({ where: { externalId: placeId } });
    }
    if (!existing) {
      existing = await db.clinic.findFirst({ where: { name, city, state } });
    }

    if (existing) {
      duplicateRows++;
      continue;
    }

    if (!dryRun) {
      try {
        // Create the ProspectClinic record
        const clinic = await db.clinic.create({
          data: {
            externalId: placeId || null,
            name,
            website: website || null,
            primaryPhone: formattedPhone,
            generalEmail: cleanEmail,
            address: street || null,
            city,
            state,
            zip: zip || null,
            clinicType: "private_practice",
            pipelineStage: "imported",
            priority: "normal",
            readinessScore: 0,
            directoryStatus: "imported",
            notes: `Vertical: ${vertical || 'N/A'}. Market: ${market || 'N/A'}. Affluence score: ${affluence}. Rating: ${rating} (${reviews} reviews).`,
            dateImported: new Date()
          }
        });

        // Add primary location record
        await db.clinicLocation.create({
          data: {
            clinicId: clinic.id,
            label: "Main Location",
            address: street || null,
            city,
            state,
            zip: zip || null,
            phone: formattedPhone,
            isPrimary: true
          }
        });

        // Add directory profile draft
        await db.directoryProfile.create({
          data: {
            clinicId: clinic.id,
            listingStatus: "imported",
            claimStatus: "unclaimed",
            verificationStatus: "pending",
            profileCompleteness: 10,
            publicationStatus: "draft"
          }
        });

        successfulRows++;
      } catch (err: any) {
        failedRows++;
        errors.push({ row: i, clinicName: name, error: err.message });
      }
    } else {
      successfulRows++;
    }
  }

  // Update batch run status
  if (!dryRun && batch) {
    await db.clinicImport.update({
      where: { id: batch.id },
      data: {
        successfulRows,
        failedRows,
        duplicateRows,
        status: failedRows > 0 ? "partial" : "completed",
        errorReport: JSON.stringify(errors.slice(0, 100))
      }
    });
  }

  return NextResponse.json({
    success: true,
    fileHash,
    dryRun,
    totalRows,
    imported: successfulRows,
    duplicates: duplicateRows,
    failed: failedRows,
    errors: errors.slice(0, 50)
  });
}
