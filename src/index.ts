/**
 * Founder Media OS — BullMQ Worker
 * Processes: 8-agent pipeline, video generation dispatch/poll, QC scoring
 */

import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { processAgentPipelineJob } from "./processors/agent-pipeline.js";
import { processGenerationDispatchJob } from "./processors/generation-dispatch.js";
import { processGenerationPollJob } from "./processors/generation-poll.js";
import { processQCJob } from "./processors/qc-scoring.js";

// ── Redis Connection ───────────────────────────────────────────────────────────

const rawRedisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// Upstash requires TLS — auto-upgrade redis:// → rediss://
const isUpstash = rawRedisUrl.includes("upstash.io");
const redisUrl = isUpstash && rawRedisUrl.startsWith("redis://")
  ? rawRedisUrl.replace("redis://", "rediss://")
  : rawRedisUrl;

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  tls: isUpstash ? {} : undefined,
  connectTimeout: 10_000,
  lazyConnect: false,
});

connection.on("connect", () => console.log("✅ Redis connected"));
connection.on("ready", () => console.log("✅ Redis ready"));
connection.on("error", (err) => console.error("❌ Redis error:", err.message));

// ── Queue Names ───────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  AGENT_PIPELINE: "fmo-agent-pipeline",
  GENERATION_DISPATCH: "fmo-generation-dispatch",
  GENERATION_POLL: "fmo-generation-poll",
  QC_SCORING: "fmo-qc-scoring",
} as const;

// ── Workers ───────────────────────────────────────────────────────────────────

const baseWorkerOptions = {
  connection,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

const agentPipelineWorker = new Worker(
  QUEUE_NAMES.AGENT_PIPELINE,
  processAgentPipelineJob,
  { ...baseWorkerOptions, concurrency: 2 }
);

const generationDispatchWorker = new Worker(
  QUEUE_NAMES.GENERATION_DISPATCH,
  processGenerationDispatchJob,
  { ...baseWorkerOptions, concurrency: 5 }
);

const generationPollWorker = new Worker(
  QUEUE_NAMES.GENERATION_POLL,
  processGenerationPollJob,
  { ...baseWorkerOptions, concurrency: 10 }
);

const qcScoringWorker = new Worker(
  QUEUE_NAMES.QC_SCORING,
  processQCJob,
  { ...baseWorkerOptions, concurrency: 3 }
);

// ── Event Logging ─────────────────────────────────────────────────────────────

const workers = [
  { name: "AgentPipeline", worker: agentPipelineWorker },
  { name: "GenerationDispatch", worker: generationDispatchWorker },
  { name: "GenerationPoll", worker: generationPollWorker },
  { name: "QCScoring", worker: qcScoringWorker },
];

for (const { name, worker } of workers) {
  worker.on("completed", (job) => {
    console.log(`✅ [${name}] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`❌ [${name}] Job ${job?.id} failed: ${err.message}`);
  });
  worker.on("active", (job) => {
    console.log(`⚡ [${name}] Job ${job.id} started`);
  });
  worker.on("stalled", (jobId) => {
    console.warn(`⚠️  [${name}] Job ${jobId} stalled`);
  });
  worker.on("error", (err) => {
    console.error(`❌ [${name}] Worker error: ${err.message}`);
  });
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

async function shutdown() {
  console.log("\n🛑 Shutting down workers...");
  await Promise.all(workers.map(({ worker }) => worker.close()));
  await connection.quit();
  console.log("✅ Workers shut down cleanly");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ── Startup ───────────────────────────────────────────────────────────────────

console.log("🚀 Founder Media OS Worker started");
console.log(`📡 Redis: ${isUpstash ? "Upstash (TLS)" : redisUrl}`);
console.log(`⚙️  Workers: ${workers.map((w) => w.name).join(", ")}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
