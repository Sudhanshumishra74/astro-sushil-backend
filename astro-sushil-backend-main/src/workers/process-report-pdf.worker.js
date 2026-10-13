import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { processReportPDF } from "../utils/processReportPdf.js";

const worker = new Worker(
  "process-report-pdf",
  async (job) => {
    await processReportPDF(job.data);
  },
  {
    connection: redisConnection,
  },
);

worker.on("failed", (job, err) => {
  const { reportOrderId } = job?.data || {};
  const attemptsMade = job?.attemptsMade ?? 0;
  const totalAttempts = job?.opts?.attempts ?? 10;
  const attemptsLeft = totalAttempts - attemptsMade;

  console.error(
    `[process-report-pdf] Job failed | reportOrderId: ${reportOrderId} | attempt: ${attemptsMade}/${totalAttempts} | attemptsLeft: ${attemptsLeft} | reason: ${err?.message}`,
    { stack: err?.stack, jobId: job?.id, jobData: job?.data },
  );
});

worker.on("error", (err) => {
  console.error("[process-report-pdf] Worker connection error:", err);
});
