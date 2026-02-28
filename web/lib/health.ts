interface HealthScoreInput {
  hashMatched: boolean;
  custodyCount: number;
  actionCount: number;
  lastTransferAt?: string;
}

// Health score combines integrity, custody depth, investigative depth, and freshness.
export function computeHealthScore(input: HealthScoreInput): number {
  let score = 0;

  // Integrity has highest weight.
  score += input.hashMatched ? 45 : 0;

  // More custody checkpoints imply stronger audit trail.
  score += Math.min(25, input.custodyCount * 5);

  // Investigative actions increase confidence that due process happened.
  score += Math.min(15, input.actionCount * 3);

  // Fresh records score better; stale records indicate process delays.
  if (input.lastTransferAt) {
    const lastTs = new Date(input.lastTransferAt).getTime();
    const ageHours = (Date.now() - lastTs) / (1000 * 60 * 60);
    if (ageHours <= 24) {
      score += 15;
    } else if (ageHours <= 72) {
      score += 10;
    } else if (ageHours <= 168) {
      score += 6;
    } else {
      score += 2;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function scoreLabel(score: number): "Excellent" | "Good" | "At Risk" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  return "At Risk";
}
