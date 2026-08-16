import { cn } from "@/lib/utils";

const METER_FLOOR_DB = -60;
const METER_CEIL_DB = 0;

function dbToPercent(db: number): number {
  const clamped = Math.min(METER_CEIL_DB, Math.max(METER_FLOOR_DB, db));
  return ((clamped - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB)) * 100;
}

/**
 * Live mic-level bar, reused in two contexts (Phase 3 PRD P3.1): the active
 * voice session's controls, and the Settings noise-gate preview. `thresholdDb`
 * is optional — when present, a marker shows where the gate will open/close.
 */
export function MicLevelMeter({
  levelDb,
  thresholdDb,
}: {
  levelDb: number | null;
  thresholdDb?: number;
}) {
  const levelPercent = dbToPercent(levelDb ?? METER_FLOOR_DB);
  const thresholdPercent = thresholdDb !== undefined ? dbToPercent(thresholdDb) : null;

  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={METER_FLOOR_DB}
      aria-valuemax={METER_CEIL_DB}
      aria-valuenow={levelDb ?? METER_FLOOR_DB}
    >
      <div
        className={cn("h-full rounded-full bg-success transition-[width] duration-75")}
        style={{ width: `${levelPercent}%` }}
      />
      {thresholdPercent !== null && (
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-warning"
          style={{ left: `${thresholdPercent}%` }}
        />
      )}
    </div>
  );
}
