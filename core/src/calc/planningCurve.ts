export interface PlanningCurvePoint { x: number, value: number }

export function betterCurvePoint(candidate: PlanningCurvePoint, current?: PlanningCurvePoint | null): boolean {
  if (!current) return true
  const delta = candidate.value - current.value
  const tolerance = 1e-12 * Math.max(Math.abs(candidate.value), Math.abs(current.value))
  return delta > tolerance || (Math.abs(delta) <= tolerance && candidate.x < current.x)
}

export function planningCurvePeak(points: readonly PlanningCurvePoint[]): PlanningCurvePoint | undefined {
  return points.reduce<PlanningCurvePoint | undefined>((best, point) => betterCurvePoint(point, best) ? point : best, undefined)
}
