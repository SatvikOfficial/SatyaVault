"use client";

import { computeHealthScore, scoreLabel } from "@/lib/health";

interface HealthBadgeProps {
  hashMatched: boolean;
  custodyCount: number;
  actionCount: number;
  lastTransferAt?: string;
}

export function HealthBadge({ hashMatched, custodyCount, actionCount, lastTransferAt }: HealthBadgeProps) {
  const score = computeHealthScore({ hashMatched, custodyCount, actionCount, lastTransferAt });
  const label = scoreLabel(score);

  const colorClass =
    score >= 80
      ? "bg-green text-white"
      : score >= 60
        ? "bg-saffron text-slate-900"
        : "bg-red-600 text-white";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-gov">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Evidence Health Score</p>
      <div className="mt-3 flex items-center gap-4">
        <div className={`inline-flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold ${colorClass}`}>
          {score}
        </div>
        <div>
          <p className="font-heading text-xl font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-600">Integrity + custody + actions + freshness</p>
        </div>
      </div>
    </div>
  );
}
