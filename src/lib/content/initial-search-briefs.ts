export type SearchContentBrief = {
  slug: string;
  title: string;
  searchIntent: "informational" | "commercial_investigation";
  primaryKeyword: string;
  secondaryKeywords: string[];
  metaDescription: string;
  tableOfContents: string[];
  requiredSections: string[];
  suggestedSources: Array<{ organization: string; topic: string; url: string }>;
  internalLinks: string[];
  directoryCta: string;
  assessmentCta: string;
  medicalDisclaimer: string;
  relatedArticleSlugs: string[];
};

const EDUCATIONAL_DISCLAIMER =
  "This article is for general education and is not medical advice. A licensed healthcare professional must evaluate symptoms, laboratory results, risks, and treatment options for each patient.";

export const INITIAL_SEARCH_BRIEFS: SearchContentBrief[] = [
  {
    slug: "how-to-choose-a-trt-clinic",
    title: "How to Choose a TRT Clinic: A Patient Safety Checklist",
    searchIntent: "commercial_investigation",
    primaryKeyword: "how to choose a TRT clinic",
    secondaryKeywords: [
      "best TRT clinic",
      "reputable testosterone clinic",
      "TRT clinic checklist",
      "testosterone clinic near me",
    ],
    metaDescription:
      "Use a practical checklist to compare TRT clinics, provider oversight, testing, monitoring, costs, and follow-up before choosing care.",
    tableOfContents: [
      "Start with licensed clinical oversight",
      "Confirm the diagnostic process",
      "Review monitoring and follow-up",
      "Understand treatment options and pharmacy practices",
      "Compare costs and cancellation terms",
      "Check telehealth and state licensure",
      "Red flags to avoid",
      "TRT clinic comparison checklist",
    ],
    requiredSections: [
      "Explain that symptoms alone do not establish testosterone deficiency.",
      "Describe repeated morning testing and clinician evaluation without prescribing a universal protocol.",
      "Explain fertility, contraindication, monitoring, and adverse-effect conversations.",
      "Distinguish transparent clinical care from guaranteed-outcome or performance claims.",
      "Provide questions the reader can take to a consultation.",
    ],
    suggestedSources: [
      {
        organization: "Endocrine Society",
        topic: "Testosterone therapy clinical practice guideline",
        url: "https://www.endocrine.org/clinical-practice-guidelines/testosterone-therapy",
      },
      {
        organization: "American Urological Association",
        topic: "Testosterone deficiency guideline",
        url: "https://www.auanet.org/guidelines-and-quality/guidelines/testosterone-deficiency-guideline",
      },
      {
        organization: "U.S. Food and Drug Administration",
        topic: "Testosterone product safety information",
        url: "https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/testosterone-information",
      },
    ],
    internalLinks: [
      "/directory",
      "/patients",
      "/journal/questions-to-ask-before-starting-testosterone-therapy",
      "/journal/telehealth-vs-in-person-mens-health-clinics",
    ],
    directoryCta: "Compare approved public clinic profiles",
    assessmentCta: "Start the private care-navigation assessment",
    medicalDisclaimer: EDUCATIONAL_DISCLAIMER,
    relatedArticleSlugs: [
      "questions-to-ask-before-starting-testosterone-therapy",
      "how-to-find-a-reputable-mens-health-clinic-near-you",
    ],
  },
  {
    slug: "questions-to-ask-before-starting-testosterone-therapy",
    title: "Questions to Ask Before Starting Testosterone Therapy",
    searchIntent: "informational",
    primaryKeyword: "questions to ask before starting testosterone therapy",
    secondaryKeywords: [
      "TRT consultation questions",
      "testosterone therapy risks",
      "TRT monitoring questions",
      "TRT fertility questions",
    ],
    metaDescription:
      "Bring these questions to a testosterone-therapy consultation to discuss diagnosis, benefits, risks, fertility, monitoring, cost, and alternatives.",
    tableOfContents: [
      "Questions about diagnosis",
      "Questions about expected benefits",
      "Questions about risks and contraindications",
      "Questions about fertility",
      "Questions about treatment options",
      "Questions about monitoring",
      "Questions about cost and continuity of care",
      "What to bring to the appointment",
    ],
    requiredSections: [
      "Avoid universal dosing, lab ranges, or treatment promises.",
      "Explain why baseline health history and repeat testing matter.",
      "Include fertility planning and alternatives discussion.",
      "Include follow-up, lab access, side effects, and stopping-care questions.",
      "Provide a printable consultation checklist.",
    ],
    suggestedSources: [
      {
        organization: "Endocrine Society",
        topic: "Patient and clinician guidance on testosterone therapy",
        url: "https://www.endocrine.org/clinical-practice-guidelines/testosterone-therapy",
      },
      {
        organization: "American Urological Association",
        topic: "Testosterone deficiency guideline",
        url: "https://www.auanet.org/guidelines-and-quality/guidelines/testosterone-deficiency-guideline",
      },
      {
        organization: "MedlinePlus",
        topic: "Testosterone drug information",
        url: "https://medlineplus.gov/druginfo/meds/a619028.html",
      },
    ],
    internalLinks: [
      "/journal/how-to-choose-a-trt-clinic",
      "/directory",
      "/patients",
    ],
    directoryCta: "Find clinics with reviewed public profiles",
    assessmentCta: "Prepare for a care-navigation conversation",
    medicalDisclaimer: EDUCATIONAL_DISCLAIMER,
    relatedArticleSlugs: [
      "how-to-choose-a-trt-clinic",
      "telehealth-vs-in-person-mens-health-clinics",
    ],
  },
  {
    slug: "how-to-find-a-reputable-mens-health-clinic-near-you",
    title: "How to Find a Reputable Men's Health Clinic Near You",
    searchIntent: "commercial_investigation",
    primaryKeyword: "reputable men's health clinic near me",
    secondaryKeywords: [
      "men's health clinic near me",
      "verified men's health clinic",
      "how to compare men's health clinics",
      "telehealth men's health clinic",
    ],
    metaDescription:
      "Learn how to verify licensing, clinical oversight, services, costs, privacy, and follow-up when comparing men's health clinics near you.",
    tableOfContents: [
      "Define the care you are looking for",
      "Verify licenses and clinical oversight",
      "Check the clinic's evaluation process",
      "Compare in-person and telehealth access",
      "Review privacy and communication practices",
      "Understand pricing and insurance",
      "Look for continuity of care",
      "Use a clinic comparison worksheet",
    ],
    requiredSections: [
      "Explain how to verify professional licenses through state boards.",
      "Distinguish a public profile review from clinical accreditation.",
      "Discuss privacy, intake, follow-up, and escalation practices.",
      "Avoid ranking or endorsing clinics without verified evidence.",
      "Explain how the Novalyte directory publication process works.",
    ],
    suggestedSources: [
      {
        organization: "Federation of State Medical Boards",
        topic: "Physician license verification",
        url: "https://www.fsmb.org/contact-a-state-medical-board/",
      },
      {
        organization: "U.S. Department of Health and Human Services",
        topic: "HIPAA information for individuals",
        url: "https://www.hhs.gov/hipaa/for-individuals/index.html",
      },
      {
        organization: "Centers for Medicare & Medicaid Services",
        topic: "Clinical laboratory standards",
        url: "https://www.cms.gov/medicare/quality/clinical-laboratory-improvement-amendments",
      },
    ],
    internalLinks: ["/directory", "/patients", "/journal/telehealth-vs-in-person-mens-health-clinics"],
    directoryCta: "Search approved clinic profiles",
    assessmentCta: "Start a private care-navigation assessment",
    medicalDisclaimer: EDUCATIONAL_DISCLAIMER,
    relatedArticleSlugs: [
      "how-to-choose-a-trt-clinic",
      "what-to-look-for-in-a-medical-weight-loss-clinic",
    ],
  },
  {
    slug: "what-to-look-for-in-a-medical-weight-loss-clinic",
    title: "What to Look for in a Medical Weight-Loss Clinic",
    searchIntent: "commercial_investigation",
    primaryKeyword: "what to look for in a medical weight loss clinic",
    secondaryKeywords: [
      "reputable weight loss clinic",
      "medical weight loss clinic near me",
      "GLP-1 clinic checklist",
      "weight loss clinic questions",
    ],
    metaDescription:
      "Compare medical weight-loss clinics using a checklist for clinician oversight, screening, medication safety, nutrition, follow-up, and total cost.",
    tableOfContents: [
      "What makes weight-loss care medical",
      "Clinical screening before treatment",
      "Medication sourcing and safety",
      "Nutrition and activity support",
      "Monitoring side effects and progress",
      "Long-term maintenance planning",
      "Pricing and cancellation terms",
      "Red flags to avoid",
    ],
    requiredSections: [
      "Avoid implying that any medication is appropriate for every reader.",
      "Discuss contraindication screening and medication history generally.",
      "Explain FDA-approved products versus compounded products without giving legal advice.",
      "Include lean-mass preservation and long-term maintenance questions.",
      "Include transparent cost and refill-continuity questions.",
    ],
    suggestedSources: [
      {
        organization: "U.S. Food and Drug Administration",
        topic: "FDA-approved medications for chronic weight management",
        url: "https://www.fda.gov/consumers/consumer-updates/weight-loss-product-notice",
      },
      {
        organization: "National Institute of Diabetes and Digestive and Kidney Diseases",
        topic: "Prescription medications for obesity",
        url: "https://www.niddk.nih.gov/health-information/weight-management/prescription-medications-treat-overweight-obesity",
      },
      {
        organization: "Centers for Disease Control and Prevention",
        topic: "Healthy weight and growth",
        url: "https://www.cdc.gov/healthy-weight-growth/",
      },
    ],
    internalLinks: ["/directory", "/patients", "/journal/how-to-find-a-reputable-mens-health-clinic-near-you"],
    directoryCta: "Compare approved weight-management clinic profiles",
    assessmentCta: "Start the weight-management assessment",
    medicalDisclaimer: EDUCATIONAL_DISCLAIMER,
    relatedArticleSlugs: [
      "how-to-find-a-reputable-mens-health-clinic-near-you",
      "telehealth-vs-in-person-mens-health-clinics",
    ],
  },
  {
    slug: "telehealth-vs-in-person-mens-health-clinics",
    title: "Telehealth vs. In-Person Men's Health Clinics: How to Compare",
    searchIntent: "commercial_investigation",
    primaryKeyword: "telehealth vs in-person men's health clinic",
    secondaryKeywords: [
      "online men's health clinic",
      "telehealth TRT clinic",
      "in-person men's health clinic",
      "men's health telemedicine",
    ],
    metaDescription:
      "Compare telehealth and in-person men's health clinics across licensing, exams, labs, privacy, convenience, follow-up, and cost.",
    tableOfContents: [
      "How the care formats differ",
      "Licensing and location rules",
      "Physical exams and laboratory testing",
      "Privacy and technology",
      "Continuity and urgent concerns",
      "Convenience and cost",
      "When a hybrid model may help",
      "Questions to ask either type of clinic",
    ],
    requiredSections: [
      "Explain that telehealth availability and prescribing rules vary by state and treatment.",
      "Avoid making categorical statements about controlled-substance prescribing.",
      "Discuss when physical examination or local testing may be required.",
      "Compare privacy, continuity, accessibility, and escalation options.",
      "Provide a neutral decision checklist.",
    ],
    suggestedSources: [
      {
        organization: "U.S. Department of Health and Human Services",
        topic: "Telehealth policy and patient resources",
        url: "https://telehealth.hhs.gov/",
      },
      {
        organization: "Federation of State Medical Boards",
        topic: "Telemedicine policies and state licensure",
        url: "https://www.fsmb.org/advocacy/telemedicine/",
      },
      {
        organization: "U.S. Drug Enforcement Administration",
        topic: "Telemedicine prescribing rules",
        url: "https://www.dea.gov/telemedicine",
      },
    ],
    internalLinks: ["/directory", "/patients", "/journal/how-to-choose-a-trt-clinic"],
    directoryCta: "Filter approved clinics by care format",
    assessmentCta: "Tell us your care-format preference",
    medicalDisclaimer: EDUCATIONAL_DISCLAIMER,
    relatedArticleSlugs: [
      "how-to-choose-a-trt-clinic",
      "how-to-find-a-reputable-mens-health-clinic-near-you",
    ],
  },
];
