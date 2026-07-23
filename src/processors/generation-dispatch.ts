/**
 * Generation Dispatch Processor
 * Submits shots to LTX / Runway / Grok Imagine for video generation.
 */

import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface GenerationDispatchJobData {
  shotId: string;
  projectId: string;
  provider: "LTX" | "RUNWAY" | "GROK_IMAGINE";
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  fps?: number;
}

export async function processGenerationDispatchJob(
  job: Job<GenerationDispatchJobData>
): Promise<void> {
  const { shotId, provider, prompt, negativePrompt, aspectRatio, durationSeconds, fps } = job.data;

  console.log(`[GenerationDispatch] Dispatching shot ${shotId} to ${provider}`);

  await prisma.shot.update({
    where: { id: shotId },
    data: { status: "GENERATING" },
  }).catch(() => {});

  try {
    let providerJobId: string;

    switch (provider) {
      case "LTX":
        providerJobId = await dispatchToLTX({ prompt, negativePrompt, aspectRatio, durationSeconds, fps });
        break;
      case "RUNWAY":
        providerJobId = await dispatchToRunway({ prompt, negativePrompt, aspectRatio, durationSeconds });
        break;
      case "GROK_IMAGINE":
        providerJobId = await dispatchToGrokImagine({ prompt, negativePrompt, aspectRatio });
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    await prisma.shot.update({
      where: { id: shotId },
      data: { providerJobId, status: "GENERATING" },
    });

    console.log(`[GenerationDispatch] Shot ${shotId} dispatched. Job ID: ${providerJobId}`);
  } catch (err) {
    await prisma.shot.update({
      where: { id: shotId },
      data: { status: "FAILED" },
    }).catch(() => {});
    throw err;
  }
}

async function dispatchToLTX(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  fps?: number;
}): Promise<string> {
  const apiKey = process.env.LTX_API_KEY;
  if (!apiKey) throw new Error("LTX_API_KEY not configured");

  const [width, height] = resolveResolution(params.aspectRatio ?? "9:16");

  const res = await fetch("https://api.ltx.studio/v1/videos/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "ltx-video-2-3-pro",
      prompt: params.prompt,
      negative_prompt: params.negativePrompt ?? "",
      width,
      height,
      num_frames: Math.round((params.durationSeconds ?? 5) * (params.fps ?? 24)),
      frame_rate: params.fps ?? 24,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LTX dispatch error ${res.status}: ${err}`);
  }

  const json = await res.json() as { id: string };
  return json.id;
}

async function dispatchToRunway(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSeconds?: number;
}): Promise<string> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY not configured");

  const res = await fetch("https://api.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model: "gen4_turbo",
      promptText: params.prompt,
      ratio: params.aspectRatio?.replace(":", "x") ?? "9x16",
      duration: params.durationSeconds ?? 5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Runway dispatch error ${res.status}: ${err}`);
  }

  const json = await res.json() as { id: string };
  return json.id;
}

async function dispatchToGrokImagine(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
}): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === "xai-test") throw new Error("XAI_API_KEY not configured");

  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2-image",
      prompt: params.prompt,
      n: 1,
      response_format: "url",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok Imagine dispatch error ${res.status}: ${err}`);
  }

  const json = await res.json() as { data: Array<{ url: string }> };
  return json.data[0].url; // For images, the URL is the "job ID"
}

function resolveResolution(aspectRatio: string): [number, number] {
  const map: Record<string, [number, number]> = {
    "9:16": [768, 1360],
    "16:9": [1360, 768],
    "1:1": [1024, 1024],
    "4:5": [896, 1120],
    "21:9": [1680, 720],
  };
  return map[aspectRatio] ?? [768, 1360];
}
