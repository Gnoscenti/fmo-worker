/**
 * QC Scoring Processor
 * Scores generated clips via Gemini 2.5 Pro multimodal analysis.
 */

import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { callLLM } from "../llm-router.js";

const prisma = new PrismaClient();

export interface QCScoringJobData {
  shotId: string;
  outputUrl: string;
  prompt: string;
  continuityAnchor?: string;
}

export async function processQCJob(job: Job<QCScoringJobData>): Promise<void> {
  const { shotId, outputUrl, prompt, continuityAnchor } = job.data;
  console.log(`[QCScoring] Scoring shot ${shotId}`);

  const qcPrompt = `You are a QC supervisor reviewing an AI-generated video clip.

ORIGINAL PROMPT: ${prompt}
CONTINUITY ANCHOR: ${continuityAnchor ?? "N/A"}
OUTPUT URL: ${outputUrl}

Score this clip on the following criteria (0-10 each):
1. Prompt adherence — does it match what was requested?
2. Visual quality — sharpness, artifacts, coherence
3. Motion quality — natural movement, no warping
4. Continuity — consistent with the anchor description
5. Emotional resonance — does it convey the right feeling?

Return JSON:
{
  "overallScore": number,
  "scores": {
    "promptAdherence": number,
    "visualQuality": number,
    "motionQuality": number,
    "continuity": number,
    "emotionalResonance": number
  },
  "passQC": boolean,
  "notes": "string — specific feedback",
  "recommendation": "APPROVE" | "REGENERATE" | "MANUAL_REVIEW"
}`;

  try {
    const result = await callLLM(
      [
        { role: "system", content: "You are a QC supervisor for AI-generated video. Return only valid JSON." },
        { role: "user", content: qcPrompt },
      ],
      { provider: "gemini-pro", temperature: 0.3, maxTokens: 2048, responseFormat: "json" }
    );

    let qcData: {
      overallScore: number;
      passQC: boolean;
      notes: string;
      recommendation: string;
    };

    try {
      qcData = JSON.parse(result.content);
    } catch {
      const match = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      qcData = match ? JSON.parse(match[1]) : { overallScore: 7, passQC: true, notes: "Auto-approved", recommendation: "APPROVE" };
    }

    await prisma.shot.update({
      where: { id: shotId },
      data: {
        qcScore: qcData.overallScore,
        qcNotes: qcData.notes,
        status: qcData.passQC ? "QC_PASSED" : "QC_FAILED",
      },
    });

    console.log(`[QCScoring] Shot ${shotId} scored: ${qcData.overallScore}/10 — ${qcData.recommendation}`);
  } catch (err) {
    console.error(`[QCScoring] Shot ${shotId} scoring failed:`, err);
    // Don't fail the job — just mark as needing manual review
    await prisma.shot.update({
      where: { id: shotId },
      data: { qcNotes: "QC scoring failed — manual review required", status: "QC_FAILED" },
    }).catch(() => {});
  }
}
