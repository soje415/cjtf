/**
 * Temporary pilot relaxations.
 *
 * These loosen real checks to get the pilot moving, and are all meant to come
 * back on before general rollout. Everything gated here writes an audit note on
 * the affected record, so you can find exactly which submissions came in under
 * relaxed rules and re-verify them later rather than guessing.
 */

/**
 * Relax the office-registration submit gates: the office-space photo upload and
 * the NIN/BVN identity confirmation stop blocking submission.
 *
 * ⚠️ With this on, an office registration can reach INT screening with no photo
 * of the premises and no verified identity behind it. INT and Admin still review
 * and can still reject — this removes the automatic gate, not the human one.
 */
export function officeChecksRelaxed(): boolean {
  return process.env.NEXT_PUBLIC_PILOT_RELAXED_OFFICE_CHECKS === 'true'
}

/** Human-readable list of what was skipped, for the audit note. */
export function describeSkippedOfficeChecks(opts: {
  missingPhotos: boolean
  missingIdentity: boolean
}): string | null {
  const skipped: string[] = []
  if (opts.missingPhotos) skipped.push('no office-space photo uploaded')
  if (opts.missingIdentity) skipped.push('identity (NIN/BVN) not verified')
  if (skipped.length === 0) return null
  return `Submitted under pilot relaxed checks — ${skipped.join('; ')}. Re-verify before the permit is treated as fully vetted.`
}
