/**
 * Founder Media OS — Full 8-Agent Pipeline
 * Atlas → Vox → Lux → Slate → Figaro → Canvi → Dobe → Tempo
 */

import { callLLM, AGENT_PROVIDER_MAP } from "./llm-router.js";

export interface PipelineInput {
  projectId: string;
  rawIdea: string;
  founderName?: string;
  businessName?: string;
  platform?: string;
  format?: string;
  durationTarget?: number;
  tone?: string;
  aspectRatio?: string;
  primaryProvider?: string;
  shotCount?: number;
}

export interface PipelineCallbacks {
  onProgress?: (p: { agentName: string; status: string; durationMs?: number }) => Promise<void>;
  onAgentComplete?: (agentName: string, output: unknown) => Promise<void>;
}

export interface PipelineOutput {
  projectId: string;
  atlas: unknown;
  vox: unknown;
  lux: unknown;
  slate: unknown;
  figaro: unknown;
  canvi: unknown;
  dobe: unknown;
  tempo: unknown;
  completedAt: string;
  totalAgentsRun: number;
}

// ── Atlas: Strategy & Campaign Architecture ───────────────────────────────────
async function runAtlas(input: PipelineInput) {
  const prompt = `You are Atlas, a world-class brand strategist and campaign architect.

Analyze this founder's raw idea and build a complete campaign strategy.

FOUNDER: ${input.founderName ?? "The Founder"}
BUSINESS: ${input.businessName ?? "The Business"}
PLATFORM: ${input.platform ?? "youtube"}
FORMAT: ${input.format ?? "short-form"}
DURATION: ${input.durationTarget ?? 60} seconds
TONE: ${input.tone ?? "authentic"}
RAW IDEA: ${input.rawIdea}

Return a JSON object with this EXACT structure:
{
  "campaignTitle": "string",
  "logline": "string — one sentence that captures the entire campaign",
  "targetAudience": {
    "primary": "string",
    "psychographic": "string",
    "painPoint": "string",
    "desiredOutcome": "string"
  },
  "coreMessage": "string — the single most important thing the audience should feel/think",
  "narrativeArc": "string — the story structure (problem → tension → resolution)",
  "emotionalJourney": ["beat1", "beat2", "beat3", "beat4"],
  "competitiveAngle": "string — what makes this different from everything else",
  "callToAction": "string — the specific action we want the viewer to take",
  "contentPillars": ["pillar1", "pillar2", "pillar3"],
  "platformStrategy": {
    "platform": "${input.platform ?? "youtube"}",
    "optimalLength": ${input.durationTarget ?? 60},
    "hookWindow": "string — first X seconds strategy",
    "retentionTactics": ["tactic1", "tactic2"]
  },
  "successMetrics": ["metric1", "metric2", "metric3"]
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Atlas, a world-class brand strategist. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["ATLAS"], temperature: 0.8, maxTokens: 4096, responseFormat: "json" }
  );
  return parseJSON(result.content, "Atlas");
}

// ── Vox: Script Writing ───────────────────────────────────────────────────────
async function runVox(input: PipelineInput, strategy: Awaited<ReturnType<typeof runAtlas>>) {
  const prompt = `You are Vox, an elite scriptwriter who crafts viral short-form video scripts.

CAMPAIGN STRATEGY:
${JSON.stringify(strategy, null, 2)}

PLATFORM: ${input.platform ?? "youtube"}
DURATION: ${input.durationTarget ?? 60} seconds
TONE: ${input.tone ?? "authentic"}
FORMAT: ${input.format ?? "short-form"}

Write a complete, production-ready script. Return JSON:
{
  "title": "string",
  "hook": "string — the first 3-5 seconds, must stop the scroll",
  "body": "string — the full script body with scene directions in [brackets]",
  "cta": "string — the closing call to action",
  "durationSeconds": ${input.durationTarget ?? 60},
  "wordCount": number,
  "sceneBreakdown": [
    {
      "sceneNumber": 1,
      "timecode": "0:00-0:05",
      "action": "string — what happens visually",
      "voiceover": "string — exact words spoken",
      "emotion": "string — emotional beat"
    }
  ],
  "productionNotes": "string — key directions for the visual team"
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Vox, an elite scriptwriter. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["VOX"], temperature: 0.85, maxTokens: 6144, responseFormat: "json" }
  );
  return parseJSON(result.content, "Vox");
}

// ── Lux: Visual Direction ─────────────────────────────────────────────────────
async function runLux(input: PipelineInput, strategy: unknown, script: unknown) {
  const prompt = `You are Lux, a visionary cinematographer and visual director.

CAMPAIGN: ${JSON.stringify(strategy, null, 2)}
SCRIPT: ${JSON.stringify(script, null, 2)}
ASPECT RATIO: ${input.aspectRatio ?? "9:16"}
PRIMARY PROVIDER: ${input.primaryProvider ?? "LTX"}

Design the complete visual identity. Return JSON:
{
  "overallAesthetic": "string — the visual world in one sentence",
  "colorPalette": {
    "primary": ["#hex1", "#hex2"],
    "accent": ["#hex3"],
    "gradingStyle": "string — e.g. 'warm cinematic with lifted blacks'"
  },
  "lensLanguage": {
    "focalLength": "string — e.g. '35mm equivalent'",
    "depthOfField": "string",
    "movementStyle": "string"
  },
  "lightingApproach": "string",
  "globalStylePacket": "string — the master style prompt injected into every shot",
  "negativeStylePacket": "string — what to avoid in every shot",
  "moodBoard": ["reference1", "reference2", "reference3"],
  "editingRhythm": "string — pacing and cut style"
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Lux, a visionary cinematographer. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["LUX"], temperature: 0.75, maxTokens: 4096, responseFormat: "json" }
  );
  return parseJSON(result.content, "Lux");
}

// ── Slate: Shot Manifest & Continuity Bible ───────────────────────────────────
async function runSlate(input: PipelineInput, strategy: unknown, script: unknown, visualDirection: unknown) {
  const shotCount = input.shotCount ?? 12;
  const prompt = `You are Slate, a master storyboard artist and continuity supervisor.

STRATEGY: ${JSON.stringify(strategy, null, 2)}
SCRIPT: ${JSON.stringify(script, null, 2)}
VISUAL DIRECTION: ${JSON.stringify(visualDirection, null, 2)}
ASPECT RATIO: ${input.aspectRatio ?? "9:16"}
PRIMARY PROVIDER: ${input.primaryProvider ?? "LTX"}
SHOT COUNT: ${shotCount}

Build the complete Continuity Bible and Shot Manifest. Return JSON:
{
  "continuityBible": {
    "title": "string",
    "globalLook": {
      "palette": ["#hex1", "#hex2"],
      "lighting": "string",
      "texture": "string",
      "lensLanguage": "string",
      "cameraMovement": "string",
      "worldRules": ["rule1", "rule2"]
    },
    "characters": [{ "name": "string", "description": "string", "wardrobe": "string", "hairFaceBody": "string" }],
    "locations": [{ "name": "string", "description": "string", "lighting": "string" }],
    "negativePrompt": "string",
    "driftRisks": ["risk1", "risk2"]
  },
  "globalStylePacket": "string",
  "negativePacket": "string",
  "shotManifest": [
    {
      "sequenceNumber": 1,
      "sceneNumber": 1,
      "title": "string",
      "description": "string",
      "durationSeconds": 5,
      "provider": "LTX",
      "model": "ltx-2-3-pro",
      "prompt": "string — complete generation prompt",
      "negativePrompt": "string",
      "globalStylePacket": "string",
      "characterPacket": "string",
      "locationPacket": "string",
      "cameraPacket": "string",
      "audioPacket": "string",
      "camera": "medium shot",
      "motion": "slow push in",
      "continuityAnchor": "string",
      "beatCue": "0:00",
      "aspectRatio": "${input.aspectRatio ?? "9:16"}",
      "fps": 24,
      "providerRationale": "string"
    }
  ],
  "totalDurationSeconds": number,
  "providerSummary": { "ltx": number, "runway": number, "grokImagine": number }
}

Generate exactly ${shotCount} shots in the shotManifest array.`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Slate, a master storyboard artist. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["SLATE"], temperature: 0.5, maxTokens: 16384, responseFormat: "json" }
  );
  return parseJSON(result.content, "Slate");
}

// ── Figaro: Music & Audio Direction ──────────────────────────────────────────
async function runFigaro(input: PipelineInput, strategy: unknown, script: unknown) {
  const prompt = `You are Figaro, a world-class music supervisor and audio director.

CAMPAIGN: ${JSON.stringify(strategy, null, 2)}
SCRIPT: ${JSON.stringify(script, null, 2)}
PLATFORM: ${input.platform ?? "youtube"}
DURATION: ${input.durationTarget ?? 60} seconds

Design the complete audio landscape. Return JSON:
{
  "musicDirection": {
    "genre": "string",
    "tempo": "string — e.g. '120 BPM, building'",
    "mood": "string",
    "referenceArtists": ["artist1", "artist2"],
    "licensingNotes": "string"
  },
  "soundDesign": {
    "ambience": "string",
    "keyEffects": ["sfx1", "sfx2"],
    "silenceMoments": ["when to use silence"]
  },
  "voiceoverDirection": {
    "tone": "string",
    "pacing": "string",
    "emphasis": ["word/phrase to emphasize"],
    "breathingNotes": "string"
  },
  "audioTimeline": [
    { "timecode": "0:00", "element": "string", "description": "string", "volume": "string" }
  ],
  "mixNotes": "string — overall audio mix direction"
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Figaro, a world-class music supervisor. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["FIGARO"], temperature: 0.8, maxTokens: 4096, responseFormat: "json" }
  );
  return parseJSON(result.content, "Figaro");
}

// ── Canvi: Graphics & Motion Design ──────────────────────────────────────────
async function runCanvi(input: PipelineInput, strategy: unknown, visualDirection: unknown) {
  const prompt = `You are Canvi, a motion graphics director and brand designer.

STRATEGY: ${JSON.stringify(strategy, null, 2)}
VISUAL DIRECTION: ${JSON.stringify(visualDirection, null, 2)}
PLATFORM: ${input.platform ?? "youtube"}
ASPECT RATIO: ${input.aspectRatio ?? "9:16"}

Design the complete graphics package. Return JSON:
{
  "brandSystem": {
    "primaryFont": "string",
    "accentFont": "string",
    "colorUsage": "string",
    "logoPlacement": "string"
  },
  "lowerThirds": [
    { "text": "string", "style": "string", "timing": "string", "animation": "string" }
  ],
  "titleCards": [
    { "text": "string", "style": "string", "duration": number, "animation": "string" }
  ],
  "transitions": [
    { "type": "string", "description": "string", "duration": number }
  ],
  "overlays": [
    { "type": "string", "description": "string", "timing": "string" }
  ],
  "endCard": {
    "layout": "string",
    "elements": ["element1", "element2"],
    "cta": "string",
    "duration": number
  },
  "motionPrinciples": ["principle1", "principle2", "principle3"]
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Canvi, a motion graphics director. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["CANVI"], temperature: 0.7, maxTokens: 4096, responseFormat: "json" }
  );
  return parseJSON(result.content, "Canvi");
}

// ── Dobe: Distribution & Platform Strategy ────────────────────────────────────
async function runDobe(input: PipelineInput, strategy: unknown, script: unknown) {
  const prompt = `You are Dobe, a distribution strategist and platform algorithm expert.

CAMPAIGN: ${JSON.stringify(strategy, null, 2)}
SCRIPT: ${JSON.stringify(script, null, 2)}
PRIMARY PLATFORM: ${input.platform ?? "youtube"}

Build the complete distribution playbook. Return JSON:
{
  "primaryPlatform": {
    "platform": "${input.platform ?? "youtube"}",
    "uploadStrategy": "string",
    "titleFormula": "string",
    "descriptionTemplate": "string",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "thumbnailStrategy": "string",
    "firstHourActions": ["action1", "action2"]
  },
  "crossPlatformAdaptations": [
    {
      "platform": "string",
      "formatChanges": "string",
      "captionStrategy": "string",
      "postingTime": "string"
    }
  ],
  "seoStrategy": {
    "primaryKeyword": "string",
    "secondaryKeywords": ["kw1", "kw2"],
    "searchIntent": "string"
  },
  "engagementHooks": ["hook1", "hook2", "hook3"],
  "repurposingPlan": ["clip1", "clip2"],
  "postingSchedule": "string",
  "kpis": ["kpi1", "kpi2", "kpi3"]
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Dobe, a distribution strategist. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["DOBE"], temperature: 0.7, maxTokens: 4096, responseFormat: "json" }
  );
  return parseJSON(result.content, "Dobe");
}

// ── Tempo: Edit Map & Post-Production ────────────────────────────────────────
async function runTempo(input: PipelineInput, strategy: unknown, script: unknown, visualDirection: unknown) {
  const prompt = `You are Tempo, a master editor and post-production supervisor.

STRATEGY: ${JSON.stringify(strategy, null, 2)}
SCRIPT: ${JSON.stringify(script, null, 2)}
VISUAL DIRECTION: ${JSON.stringify(visualDirection, null, 2)}
PLATFORM: ${input.platform ?? "youtube"}
DURATION: ${input.durationTarget ?? 60} seconds

Build the complete edit map and post-production plan. Return JSON:
{
  "editMap": [
    {
      "cutNumber": 1,
      "timecode": "0:00",
      "duration": number,
      "shotDescription": "string",
      "transition": "string",
      "audioNote": "string",
      "paceNote": "string"
    }
  ],
  "pacingStrategy": "string",
  "colorGradingNotes": "string",
  "audioMixNotes": "string",
  "vfxNotes": ["note1", "note2"],
  "exportSpecs": {
    "resolution": "string",
    "frameRate": number,
    "codec": "string",
    "bitrate": "string",
    "audioSpec": "string"
  },
  "deliverables": ["deliverable1", "deliverable2"],
  "reviewNotes": "string — what to watch for in the first cut review"
}`;

  const result = await callLLM(
    [
      { role: "system", content: "You are Tempo, a master editor. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { provider: AGENT_PROVIDER_MAP["TEMPO"], temperature: 0.6, maxTokens: 6144, responseFormat: "json" }
  );
  return parseJSON(result.content, "Tempo");
}

// ── Helper: Parse JSON with fallback ─────────────────────────────────────────
function parseJSON(content: string, agentName: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // fall through
      }
    }
    throw new Error(`${agentName} failed to return valid JSON: ${content.slice(0, 200)}`);
  }
}

// ── Full Pipeline Orchestrator ────────────────────────────────────────────────
export async function runFullPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<PipelineOutput> {
  const report = async (agent: string, status: string, durationMs?: number) => {
    console.log(`[Pipeline] ${agent}: ${status}${durationMs ? ` (${durationMs}ms)` : ""}`);
    await callbacks?.onProgress?.({ agentName: agent, status, durationMs });
  };

  // 1. Atlas
  await report("atlas", "started");
  let t = Date.now();
  const atlasOutput = await runAtlas(input);
  await report("atlas", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("atlas", atlasOutput);

  // 2. Vox
  await report("vox", "started");
  t = Date.now();
  const voxOutput = await runVox(input, atlasOutput);
  await report("vox", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("vox", voxOutput);

  // 3. Lux
  await report("lux", "started");
  t = Date.now();
  const luxOutput = await runLux(input, atlasOutput, voxOutput);
  await report("lux", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("lux", luxOutput);

  // 4. Slate
  await report("slate", "started");
  t = Date.now();
  const slateOutput = await runSlate(input, atlasOutput, voxOutput, luxOutput);
  await report("slate", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("slate", slateOutput);

  // 5. Figaro
  await report("figaro", "started");
  t = Date.now();
  const figaroOutput = await runFigaro(input, atlasOutput, voxOutput);
  await report("figaro", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("figaro", figaroOutput);

  // 6. Canvi
  await report("canvi", "started");
  t = Date.now();
  const canviOutput = await runCanvi(input, atlasOutput, luxOutput);
  await report("canvi", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("canvi", canviOutput);

  // 7. Dobe
  await report("dobe", "started");
  t = Date.now();
  const dobeOutput = await runDobe(input, atlasOutput, voxOutput);
  await report("dobe", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("dobe", dobeOutput);

  // 8. Tempo
  await report("tempo", "started");
  t = Date.now();
  const tempoOutput = await runTempo(input, atlasOutput, voxOutput, luxOutput);
  await report("tempo", "completed", Date.now() - t);
  await callbacks?.onAgentComplete?.("tempo", tempoOutput);

  return {
    projectId: input.projectId,
    atlas: atlasOutput,
    vox: voxOutput,
    lux: luxOutput,
    slate: slateOutput,
    figaro: figaroOutput,
    canvi: canviOutput,
    dobe: dobeOutput,
    tempo: tempoOutput,
    completedAt: new Date().toISOString(),
    totalAgentsRun: 8,
  };
}
