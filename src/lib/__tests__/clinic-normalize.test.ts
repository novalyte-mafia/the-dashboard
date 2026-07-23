import { describe, expect, it } from "vitest";
import {
  classifyDuplicate,
  normalizeClinicName,
  normalizePhoneDigits,
  normalizeWebsiteDomain,
  normalizeFullAddress,
} from "../../../scripts/lib/clinic-normalize.mjs";

describe("clinic-normalize", () => {
  it("matches exact website despite name formatting", () => {
    const a = { name: "Core T LLC", website: "https://www.coret.com/about" };
    const b = { name: "Core-T, Inc.", website: "http://coret.com" };
    expect(normalizeWebsiteDomain(a.website)).toBe(normalizeWebsiteDomain(b.website));
    expect(classifyDuplicate(a, b).kind).toBe("confirmed");
    expect(classifyDuplicate(a, b).reason).toBe("same_website_domain");
  });

  it("matches phone despite punctuation", () => {
    const a = { name: "Alpha Clinic", phone: "(512) 555-1213" };
    // 555 is placeholder — use non-555
    const real = { name: "Alpha Clinic", phone: "(512) 478-9001" };
    const b = { name: "Different Name", primaryPhone: "512-478-9001" };
    expect(normalizePhoneDigits(real.phone)).toBe("5124789001");
    expect(classifyDuplicate(real, b).kind).toBe("confirmed");
    expect(classifyDuplicate(real, b).reason).toBe("same_phone");
    expect(normalizePhoneDigits(a.phone)).toBeNull();
  });

  it("matches same name and full address", () => {
    const a = {
      name: "Limitless Male Medical Clinic",
      address: "123 Main Street Suite 200",
      city: "Cedar Rapids",
      state: "IA",
      zip: "52401",
    };
    const b = {
      name: "Limitless Male Medical Clinic LLC",
      address: "123 Main St Ste 200",
      city: "Cedar Rapids",
      state: "IA",
      zip: "52401-1234",
    };
    expect(normalizeClinicName(a.name)).toBe(normalizeClinicName(b.name));
    expect(normalizeFullAddress(a)).toBe(normalizeFullAddress(b));
    expect(classifyDuplicate(a, b).kind).toBe("confirmed");
  });

  it("same name different state is probable brand/location, not confirmed", () => {
    const a = { name: "AARX Weight Loss", city: "Ocala", state: "FL" };
    const b = { name: "AARX Weight Loss", city: "Boca Raton", state: "FL" };
    const hit = classifyDuplicate(a, b);
    expect(hit.kind).toBe("probable");
    expect(hit.reason).toBe("same_brand_different_location");
  });

  it("same name different state across states is probable", () => {
    const a = { name: "Ageless Expressions", city: "Golden", state: "CO" };
    const b = { name: "Ageless Expressions", city: "Dallas", state: "TX" };
    expect(classifyDuplicate(a, b).kind).toBe("probable");
  });

  it("similar but different clinics in same city are probable only with high overlap", () => {
    const a = { name: "Austin Mens Health Center", city: "Austin", state: "TX" };
    const b = { name: "Austin Family Dental", city: "Austin", state: "TX" };
    const hit = classifyDuplicate(a, b);
    expect(hit.kind).not.toBe("confirmed");
  });

  it("strips legal suffixes for name normalize", () => {
    expect(normalizeClinicName("Avante Medical Center, LLC")).toBe("avante medical center");
  });
});
