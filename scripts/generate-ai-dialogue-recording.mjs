#!/usr/bin/env node
/**
 * Two-AI directory call rehearsal — generates an MP3 you can listen to.
 *
 * - Clinic side: GLM plays the receptionist (dynamic)
 * - Jamil side: deterministic copilot (what founder should say)
 * - Audio: Deepgram Aura (two voices) stitched with ffmpeg
 *
 * Run: node scripts/generate-ai-dialogue-recording.mjs
 * Listen: http://localhost:3000/copilot-demo/index.html
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import {
  suggestFromTranscriptContext,
  buildReasoningPolicy,
  parseTranscript,
} from "../src/lib/calls/transcript-context.ts";
import { containsProhibitedCommercialLanguage } from "../src/lib/calls/directory-only-guard.ts";

function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY?.trim();
const GLM_KEY = process.env.GLM_API_KEY?.trim();
const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const OUT_DIR = join(process.cwd(), "public/copilot-demo");
const SEGMENTS_DIR = join(OUT_DIR, "segments");

const JAMIL_VOICE = "aura-orion-en";
const CLINIC_VOICE = "aura-asteria-en";

const OPENING =
  "Hi, this is Jamil with Novalyte AI — do you have a quick minute about your clinic's free directory listing?";

async function clinicReply(transcriptLines) {
  const transcript = transcriptLines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  if (!GLM_KEY) {
    return fallbackClinicReply(transcriptLines);
  }

  const system = `You are a clinic receptionist on a real phone call. Stay in character.
Rules:
- Short spoken replies (1-2 sentences, under 35 words).
- You may ask skeptical questions about cost, purpose, email, or say you're busy.
- NEVER offer paid services or ask about marketing packages.
- Do not say you are an AI.
- Respond naturally to what Jamil just said.`;

  const res = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GLM_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL?.trim() || "glm-5",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Transcript so far:\n${transcript}\n\nReply as Clinic only (plain speech, no labels):`,
        },
      ],
      temperature: 0.7,
      max_tokens: 120,
    }),
  });

  if (!res.ok) {
    console.warn(`Clinic GLM failed (${res.status}), using scripted clinic.`);
    return fallbackClinicReply(transcriptLines);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim().replace(/^clinic\s*:\s*/i, "");
  if (!text) return fallbackClinicReply(transcriptLines);
  return text.split("\n")[0].replace(/^["']|["']$/g, "").trim();
}

function fallbackClinicReply(lines) {
  const clinicCount = lines.filter((l) => l.speaker === "Clinic").length;
  const script = [
    "Hello, this is the front desk. How can I help you?",
    "Are you calling about our directory listing?",
    "Does the listing cost anything?",
    "What exactly would you need from us?",
    "Okay, yes — you can list us if it's free.",
    "Sure — what details do you need?",
    "Our main line is five five five, one two three, four five six seven.",
  ];
  return script[Math.min(clinicCount, script.length - 1)];
}

function validateJamilLine(text, transcript) {
  const policy = buildReasoningPolicy(transcript);
  const issues = [];
  if (containsProhibitedCommercialLanguage(text)) issues.push("prohibited_commercial");
  if (policy.unanswered_question_exists && policy.allowed_next_action === "answer_question") {
    if (/\b(best email|verification summary|phone number to list)\b/i.test(text) && !/happy to email|what's the best email/i.test(text)) {
      if (!/directory|free|permission|novalyte|calling about|not a sales/i.test(text)) {
        issues.push("skipped_direct_question");
      }
    }
  }
  return { ok: issues.length === 0, issues, policy };
}

async function tts(text, voice, outPath) {
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}`, {
    method: "POST",
    headers: { Authorization: `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`TTS failed (${voice}): ${res.status} ${await res.text()}`);
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

function stitchMp3(segmentPaths, outPath) {
  const listFile = join(SEGMENTS_DIR, "concat.txt");
  writeFileSync(
    listFile,
    segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
  );
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outPath}"`,
    { stdio: "pipe" },
  );
}

async function main() {
  if (!DEEPGRAM_KEY) {
    console.error("DEEPGRAM_API_KEY required for audio.");
    process.exit(1);
  }

  mkdirSync(SEGMENTS_DIR, { recursive: true });

  const turns = [];
  const lines = [{ speaker: "Jamil", text: OPENING }];
  turns.push({ speaker: "Jamil", text: OPENING, source: "scripted_opening" });

  const maxTurns = 8;
  for (let i = 0; i < maxTurns; i += 1) {
    const clinicText = await clinicReply(lines);
    lines.push({ speaker: "Clinic", text: clinicText });
    turns.push({ speaker: "Clinic", text: clinicText, source: GLM_KEY ? "glm_clinic" : "scripted_clinic" });

    if (i === maxTurns - 1) break;

    const transcript = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
    const copilot = suggestFromTranscriptContext({ transcript, previousSuggestions: turns.filter((t) => t.speaker === "Jamil").map((t) => t.text) });
    const validation = validateJamilLine(copilot.suggestion, transcript);

    turns.push({
      speaker: "Jamil",
      text: copilot.suggestion,
      source: "deterministic_copilot",
      intent: copilot.intent,
      policy: copilot.policy.allowed_next_action,
      validation,
    });
    lines.push({ speaker: "Jamil", text: copilot.suggestion });

    if (/thank you.*summary|best email for that/i.test(copilot.suggestion)) break;
  }

  console.log("\n=== Generated dialogue ===\n");
  for (const t of turns) {
    console.log(`${t.speaker}: ${t.text}`);
    if (t.intent) console.log(`  [copilot intent=${t.intent} policy=${t.policy}${t.validation?.ok === false ? " VALIDATION=" + t.validation.issues.join(",") : ""}]`);
  }

  const segmentPaths = [];
  let idx = 0;
  for (const t of turns) {
    const voice = t.speaker === "Jamil" ? JAMIL_VOICE : CLINIC_VOICE;
    const seg = join(SEGMENTS_DIR, `${String(idx).padStart(2, "0")}-${t.speaker.toLowerCase()}.mp3`);
    process.stdout.write(`TTS ${t.speaker}… `);
    await tts(t.text, voice, seg);
    console.log("ok");
    segmentPaths.push(seg);
    idx += 1;
  }

  const outMp3 = join(OUT_DIR, "directory-listing-rehearsal.mp3");
  stitchMp3(segmentPaths, outMp3);

  const manifest = {
    generatedAt: new Date().toISOString(),
    jamilVoice: JAMIL_VOICE,
    clinicVoice: CLINIC_VOICE,
    turns,
    audio: "/copilot-demo/directory-listing-rehearsal.mp3",
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  writeFileSync(
    join(OUT_DIR, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>Copilot Rehearsal</title>
<style>body{font-family:system-ui;max-width:760px;margin:40px auto;padding:0 16px;background:#0f172a;color:#e2e8f0}
.card{border:1px solid #334155;border-radius:12px;padding:16px;margin:16px 0;background:#1e293b}
.turn{margin:8px 0;padding:8px;border-left:3px solid #6366f1}.clinic{border-color:#22c55e}
audio{width:100%;margin:12px 0}</style></head><body>
<h1>Two-AI directory call rehearsal</h1>
<p>Clinic = GLM receptionist · Jamil = deterministic copilot · Voices = Deepgram Aura</p>
<audio controls src="./directory-listing-rehearsal.mp3"></audio>
<div class="card"><h2>Transcript</h2>${turns.map((t)=>`<div class="turn ${t.speaker==='Clinic'?'clinic':''}"><strong>${t.speaker}</strong><div>${t.text}</div></div>`).join("")}</div>
</body></html>`,
  );

  console.log(`\n✓ Recording: ${outMp3}`);
  console.log(`✓ Listen at: http://localhost:3000/copilot-demo/index.html\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
