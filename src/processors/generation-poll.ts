/**
 * Generation Poll Processor
 * Polls LTX/Runway for job completion and saves output URLs.
 */

import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface GenerationPollJobData {
  shotId: string;
  providerJobId: string;
  provider: "LTX" | "RUNWAY" | "GROK_IMAGINE";
  attempt?: number;
}

export async function processGenerationPollJob(
  job: Job<GenerationPollJobData>
): Promise<void> {
  const { shotId, providerJobId, provider } = job.data;
  console.log(`[GenerationPoll] Polling ${provider} job ${providerJobId} for shot ${shotId}`);

  try {
    let result: { status: "pending" | "complete" | "failed"; outputUrl?: string; thumbnailUrl?: string };

    switch (provider) {
      case "LTX":
        result = await pollLTX(providerJobId);
        break;
      case "RUNWAY":
        result = await pollRunway(providerJobId);
        break;
      case "GROK_IMAGINE":
        // Images are synchronous — if we have a URL, it's done
        result = { status: "complete", outputUrl: providerJobId };
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    if (result.status === "complete" && result.outputUrl) {
      await prisma.shot.update({
        where: { id: shotId },
        data: {
          status: "GENERATED",
          outputUrl: result.outputUrl,
          thumbnailUrl: result.thumbnailUrl,
          generatedAt: new Date(),
        },
      });
      console.log(`[GenerationPoll] Shot ${shotId} complete: ${result.outputUrl}`);
    } else if (result.status === "failed") {
      await prisma.shot.update({
        where: { id: shotId },
        data: { status: "FAILED" },
      });
      throw new Error(`Provider job ${providerJobId} failed`);
    } else {
      // Still pending — throw to retry
      throw new Error(`Job ${providerJobId} still pending`);
    }
  } catch (err) {
    const attempt = (job.data.attempt ?? 0) + 1;
    if (attempt < 30) {
      // Re-queue with delay
      await job.moveToDelayed(Date.now() + 10_000);
    } else {
      await prisma.shot.update({
        where: { id: shotId },
        data: { status: "FAILED" },
      }).catch(() => {});
      throw err;
    }
  }
}

async function pollLTX(jobId: string): Promise<{
  status: "pending" | "complete" | "failed";
  outputUrl?: string;
}> {
  const apiKey = process.env.LTX_API_KEY;
  if (!apiKey) throw new Error("LTX_API_KEY not configured");

  const res = await fetch(`https://api.ltx.studio/v1/videos/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`LTX poll error ${res.status}`);

  const json = await res.json() as {
    status: string;
    video_url?: string;
    download_url?: string;
  };

  if (json.status === "completed" || json.status === "succeeded") {
    return { status: "complete", outputUrl: json.video_url ?? json.download_url };
  } else if (json.status === "failed" || json.status === "error") {
    return { status: "failed" };
  }
  return { status: "pending" };
}

async function pollRunway(jobId: string): Promise<{
  status: "pending" | "complete" | "failed";
  outputUrl?: string;
}> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) throw new Error("RUNWAY_API_KEY not configured");

  const res = await fetch(`https://api.runwayml.com/v1/tasks/${jobId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": "2024-11-06",
    },
  });

  if (!res.ok) throw new Error(`Runway poll error ${res.status}`);

  const json = await res.json() as {
    status: string;
    output?: string[];
  };

  if (json.status === "SUCCEEDED") {
    return { status: "complete", outputUrl: json.output?.[0] };
  } else if (json.status === "FAILED") {
    return { status: "failed" };
  }
  return { status: "pending" };
}
