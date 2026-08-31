export default function hasRecentDuplicate(
  candidateParts: readonly string[],
  recentPostTexts: readonly string[],
): boolean {
  if (candidateParts.length === 0 || recentPostTexts.length < candidateParts.length) {
    return false;
  }

  const newestFirstCandidate = [...candidateParts].reverse();
  return recentPostTexts.some((_, start) =>
    newestFirstCandidate.every((part, offset) =>
      recentPostTexts[start + offset] === part
    )
  );
}
