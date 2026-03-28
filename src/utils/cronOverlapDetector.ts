/**
 * Cron overlap detector for integration scheduling.
 * Parses cron expressions and detects timing conflicts between jobs.
 */

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  provider?: string;
}

interface OverlapWarning {
  jobA: string;
  jobB: string;
  minutesApart: number;
  conflictMinutes: number[];
}

/**
 * Parse a cron expression and return the minutes in a 60-min window where it fires.
 * Supports: star, star-slash-N, comma-separated values, and exact numbers.
 * Only parses the minute field (first field).
 */
export function parseCronMinutes(cronExpression: string): number[] {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return [];

  const minuteField = parts[0];
  const minutes: Set<number> = new Set();

  // Handle comma-separated values
  const segments = minuteField.split(",");
  for (const segment of segments) {
    if (segment === "*") {
      for (let i = 0; i < 60; i++) minutes.add(i);
    } else if (segment.startsWith("*/")) {
      const interval = parseInt(segment.slice(2), 10);
      if (!isNaN(interval) && interval > 0) {
        for (let i = 0; i < 60; i += interval) minutes.add(i);
      }
    } else if (segment.includes("-")) {
      const [start, end] = segment.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) minutes.add(i);
      }
    } else {
      const val = parseInt(segment, 10);
      if (!isNaN(val) && val >= 0 && val < 60) minutes.add(val);
    }
  }

  return Array.from(minutes).sort((a, b) => a - b);
}

/**
 * Generate a human-readable frequency label from a cron expression.
 */
export function cronToFrequencyLabel(cronExpression: string): string {
  const minutes = parseCronMinutes(cronExpression);
  if (minutes.length === 0) return "Ukendt";
  if (minutes.length >= 60) return "Hvert minut";
  if (minutes.length >= 12) return "Hvert 5. minut";
  if (minutes.length >= 6) return "Hvert 10. minut";
  if (minutes.length >= 4) return "Hvert 15. minut";
  if (minutes.length >= 2) return `Hvert ${Math.round(60 / minutes.length)}. minut`;
  return "1 gang/time";
}

/**
 * Detect overlaps between jobs that share the same credentials/provider.
 * Returns warnings for jobs that fire within `thresholdMinutes` of each other.
 */
export function detectOverlaps(
  jobs: CronJob[],
  thresholdMinutes: number = 2,
  providerFilter?: boolean
): OverlapWarning[] {
  const warnings: OverlapWarning[] = [];

  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      const jobA = jobs[i];
      const jobB = jobs[j];

      // Skip comparison if provider filter is on and providers differ
      if (providerFilter && jobA.provider && jobB.provider && jobA.provider !== jobB.provider) {
        continue;
      }

      const minutesA = parseCronMinutes(jobA.schedule);
      const minutesB = parseCronMinutes(jobB.schedule);

      // Dynamic threshold: lower to 1 for high-frequency jobs (≤3 min)
      const freqA = estimateFrequencyFromCron(jobA.schedule);
      const freqB = estimateFrequencyFromCron(jobB.schedule);
      const effectiveThreshold = (freqA <= 3 && freqB <= 3) ? 1 : thresholdMinutes;

      const conflictMinutes: number[] = [];

      for (const mA of minutesA) {
        for (const mB of minutesB) {
          const diff = Math.abs(mA - mB);
          const circularDiff = Math.min(diff, 60 - diff);
          if (circularDiff < effectiveThreshold) {
            conflictMinutes.push(mA);
          }
        }
      }

      if (conflictMinutes.length > 0) {
        warnings.push({
          jobA: jobA.name,
          jobB: jobB.name,
          minutesApart: thresholdMinutes,
          conflictMinutes: [...new Set(conflictMinutes)].sort((a, b) => a - b),
        });
      }
    }
  }

  return warnings;
}

/**
 * Generate a 60-slot array for timeline visualization.
 * Each slot contains the jobs that fire at that minute.
 */
export function generateTimeline(jobs: CronJob[]): { minute: number; jobs: string[] }[] {
  const timeline: { minute: number; jobs: string[] }[] = [];

  for (let m = 0; m < 60; m++) {
    const jobsAtMinute: string[] = [];
    for (const job of jobs) {
      const minutes = parseCronMinutes(job.schedule);
      if (minutes.includes(m)) {
        jobsAtMinute.push(job.name);
      }
    }
    timeline.push({ minute: m, jobs: jobsAtMinute });
  }

  return timeline;
}

/**
 * Build a cron expression from frequency and offset minutes.
 */
export function buildCronExpression(frequencyMinutes: number, offsetMinutes: number[]): string {
  if (offsetMinutes.length > 0) {
    return `${offsetMinutes.join(",")} * * * *`;
  }

  const frequencyToCron: Record<number, string> = {
    5: "*/5 * * * *",
    10: "*/10 * * * *",
    15: "*/15 * * * *",
    30: "*/30 * * * *",
    60: "0 * * * *",
  };

  return frequencyToCron[frequencyMinutes] || `*/${frequencyMinutes} * * * *`;
}

/**
 * Estimate the effective frequency (minimum gap between firings)
 * from a cron expression, including wrap-around across the hour boundary.
 *
 * Uses minimum circular gap – the shortest interval between any two
 * consecutive fire-minutes. This is the correct metric for overlap
 * detection: it answers "how close can two firings get?"
 *
 * Edge-case contracts:
 *  - ≤1 minute-entry → 60 (fires at most once per hour)
 *  - ≥60 minute-entries → 1 (fires every minute)
 */
export function estimateFrequencyFromCron(cronExpression: string): number {
  const minutes = parseCronMinutes(cronExpression);
  if (minutes.length <= 1) return 60;
  if (minutes.length >= 60) return 1;

  let minGap = Infinity;
  for (let i = 1; i < minutes.length; i++) {
    minGap = Math.min(minGap, minutes[i] - minutes[i - 1]);
  }
  // Wrap-around gap: from last firing to first firing in next hour
  const wrapGap = 60 - minutes[minutes.length - 1] + minutes[0];
  minGap = Math.min(minGap, wrapGap);

  return minGap;
}

/**
 * Find the best start-minute offset for a given frequency,
 * maximizing the minimum gap to other schedules on the same provider.
 */
export function findBestOffset(
  frequencyMinutes: number,
  otherSchedules: string[],
  thresholdMinutes: number = 2
): { offset: number; minGap: number } {
  const otherMinuteSets = otherSchedules.map(s => parseCronMinutes(s));

  let bestOffset = 0;
  let bestMinGap = -1;

  for (let candidate = 0; candidate < frequencyMinutes; candidate++) {
    // Generate fire minutes for this candidate offset
    const candidateMinutes: number[] = [];
    for (let m = candidate; m < 60; m += frequencyMinutes) {
      candidateMinutes.push(m);
    }

    // Find the minimum gap to any other schedule's fire minutes
    let worstGap = Infinity;
    for (const otherMins of otherMinuteSets) {
      for (const cm of candidateMinutes) {
        for (const om of otherMins) {
          const diff = Math.abs(cm - om);
          const circularDiff = Math.min(diff, 60 - diff);
          if (circularDiff < worstGap) {
            worstGap = circularDiff;
          }
        }
      }
    }

    if (worstGap > bestMinGap) {
      bestMinGap = worstGap;
      bestOffset = candidate;
    }
  }

  return { offset: bestOffset, minGap: otherSchedules.length === 0 ? frequencyMinutes : bestMinGap };
}
