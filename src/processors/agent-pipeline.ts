/**
 * Agent Pipeline Job Processor
 * Runs the full 8-agent pipeline and saves outputs to Neon DB.
 */

import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { runFullPipeline, type PipelineInput } from "../pipeline.js";

const prisma = new PrismaClient();

export type AgentPipelineJobData = PipelineInput & { userId?: string };

export async function processAgentPipelineJob(job: Job<AgentPipelineJobData>): Promise<void> {
  const { projectId, userId, ...pipelineInput } = job.data;
  console.log(`[AgentPipeline] Starting pipeline for project ${projectId}`);

  let completedAgents = 0;
  const totalAgents = 8;

  // Mark project as processing
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "PROCESSING" },
  }).catch(() => {}); // Don't fail if project not found

  try {
    const output = await runFullPipeline(
      { projectId, ...pipelineInput },
      {
        onProgress: async (progress) => {
          console.log(`[AgentPipeline] ${progress.agentName}: ${progress.status}`);
          if (progress.status === "completed") {
            completedAgents++;
            await job.updateProgress(Math.round((completedAgents / totalAgents) * 100));
          }
        },
        onAgentComplete: async (agentName, agentOutput) => {
          await saveAgentOutput(projectId, agentName, agentOutput, userId);
        },
      }
    );

    await savePipelineOutput(projectId, output);

    // Mark project as complete
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "PIPELINE_COMPLETE" },
    }).catch(() => {});

    console.log(`[AgentPipeline] Pipeline complete for project ${projectId}`);
  } catch (err) {
    // Mark project as failed
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "FAILED" },
    }).catch(() => {});
    throw err;
  }
}

async function saveAgentOutput(
  projectId: string,
  agentName: string,
  output: unknown,
  userId?: string
): Promise<void> {
  try {
    await prisma.agentRun.create({
      data: {
        projectId,
        userId,
        agent: agentName.toUpperCase(),
        status: "COMPLETED",
        input: {} as never,
        output: output as never,
        endedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[AgentPipeline] Failed to save ${agentName} output:`, err);
  }
}

async function savePipelineOutput(
  projectId: string,
  output: Awaited<ReturnType<typeof runFullPipeline>>
): Promise<void> {
  const { vox, slate } = output as {
    vox: {
      title: string;
      hook: string;
      body: string;
      cta: string;
      durationSeconds: number;
      wordCount: number;
    };
    slate: {
      continuityBible: {
        title: string;
        globalLook: Record<string, unknown>;
        characters: unknown[];
        locations: unknown[];
        negativePrompt: string;
        driftRisks: string[];
      };
      shotManifest: Array<{
        sequenceNumber: number;
        sceneNumber: number;
        title: string;
        description: string;
        durationSeconds: number;
        provider: string;
        prompt: string;
        negativePrompt?: string;
        globalStylePacket?: string;
        characterPacket?: string;
        locationPacket?: string;
        cameraPacket?: string;
        audioPacket?: string;
        camera?: string;
        motion?: string;
        continuityAnchor?: string;
        beatCue?: string;
        aspectRatio?: string;
        fps?: number;
      }>;
    };
  };

  // Save script
  if (vox) {
    await prisma.script.create({
      data: {
        projectId,
        title: vox.title ?? "Untitled Script",
        hook: vox.hook ?? "",
        body: vox.body ?? "",
        cta: vox.cta ?? "",
        durationSeconds: vox.durationSeconds ?? 60,
        wordCount: vox.wordCount ?? 0,
        version: 1,
        isActive: true,
      },
    }).catch((e: unknown) => console.error("[Pipeline] Script save failed:", e));
  }

  // Save continuity bible
  if (slate?.continuityBible) {
    await prisma.continuityBible.create({
      data: {
        projectId,
        title: slate.continuityBible.title ?? "Continuity Bible",
        globalLook: slate.continuityBible.globalLook as never,
        characters: slate.continuityBible.characters as never,
        locations: slate.continuityBible.locations as never,
        negativePrompt: slate.continuityBible.negativePrompt ?? "",
        driftRisks: slate.continuityBible.driftRisks ?? [],
        version: 1,
      },
    }).catch((e: unknown) => console.error("[Pipeline] ContinuityBible save failed:", e));
  }

  // Save shots
  if (slate?.shotManifest) {
    for (const shot of slate.shotManifest) {
      await prisma.shot.create({
        data: {
          projectId,
          sequenceNumber: shot.sequenceNumber,
          sceneNumber: shot.sceneNumber,
          title: shot.title,
          description: shot.description,
          durationSeconds: shot.durationSeconds,
          provider: shot.provider?.toUpperCase() ?? "LTX",
          status: "READY_TO_GENERATE",
          prompt: shot.prompt,
          negativePrompt: shot.negativePrompt,
          globalStylePacket: shot.globalStylePacket,
          characterPacket: shot.characterPacket,
          locationPacket: shot.locationPacket,
          cameraPacket: shot.cameraPacket,
          audioPacket: shot.audioPacket,
          camera: shot.camera,
          motion: shot.motion,
          continuityAnchor: shot.continuityAnchor,
          beatCue: shot.beatCue,
          aspectRatio: shot.aspectRatio ?? "9:16",
          fps: shot.fps ?? 24,
        },
      }).catch((e: unknown) => console.error(`[Pipeline] Shot ${shot.sequenceNumber} save failed:`, e));
    }
  }
}
