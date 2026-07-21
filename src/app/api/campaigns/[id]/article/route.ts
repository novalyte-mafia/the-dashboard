import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { createArticle } from "@/lib/content/article-store";
import { normalizeJournalSlug } from "@/lib/journal-article-v1";
import {
  getCampaign,
  getPage,
  getVertical,
  updatePage,
} from "@/lib/campaigns/store";

const bodySchema = z.object({
  pageId: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    let pageTitle = campaign.name;
    let primaryKeyword = campaign.name;
    let relatedTreatment: string | null = null;

    if (parsed.data.pageId) {
      const page = await getPage(parsed.data.pageId);
      if (!page || page.campaign_id !== id) {
        return NextResponse.json({ error: "Page not found for this campaign." }, { status: 404 });
      }
      pageTitle = page.public_title ?? page.internal_title ?? campaign.name;
      primaryKeyword = page.seo_title ?? pageTitle;
      relatedTreatment = page.service_slug;
    } else if (campaign.vertical_id) {
      const vertical = await getVertical(campaign.vertical_id);
      relatedTreatment = vertical?.slug ?? null;
    }

    const slugBase = normalizeJournalSlug(
      `${relatedTreatment ?? "campaign"}-${campaign.name}-guide`,
    );
    const article = await createArticle(
      {
        title: `${pageTitle} — Patient Guide`,
        slug: slugBase,
        excerpt: `Educational guide supporting the ${campaign.name} campaign.`,
        category: "Treatment Guides",
        status: "draft",
        contentMarkdown: `# ${pageTitle}\n\nDraft supporting article for campaign **${campaign.name}**. Expand with clinical context, FAQs, and internal links to the landing page.`,
        relatedTreatment,
        seo: {
          title: `${pageTitle} | Novalyte Journal`,
          description: `Learn about ${pageTitle.toLowerCase()} — what to expect, how to choose a clinic, and next steps.`,
          noIndex: true,
        },
        keywords: {
          primary: primaryKeyword,
          secondary: relatedTreatment ? [relatedTreatment] : [],
        },
        tags: ["campaign-studio", campaign.id],
        changeSummary: "Created from Campaign Studio",
      },
      admin.id,
    );

    if (parsed.data.pageId) {
      await updatePage(parsed.data.pageId, { relatedArticleId: article.id });
    }

    await logActivity({
      adminId: admin.id,
      entityType: "cs_campaign",
      entityId: id,
      action: "campaign_article_created",
      summary: `Created supporting article for campaign ${campaign.name}`,
      metadata: { articleId: article.id, pageId: parsed.data.pageId ?? null },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        articleId: article.id,
        editHint: "Open Content Studio to expand the draft before publishing.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("campaign article create", error);
    const message = error instanceof Error ? error.message : "Unable to create article.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
