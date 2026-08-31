export const MAX_POST_GRAPHEMES = 300;

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function toGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}

export default function splitPostText(
  text: string,
  maxGraphemes = MAX_POST_GRAPHEMES,
): string[] {
  if (!Number.isInteger(maxGraphemes) || maxGraphemes < 1) {
    throw new RangeError("maxGraphemes must be a positive integer.");
  }

  let remaining = toGraphemes(text);
  const parts: string[] = [];

  while (remaining.length > maxGraphemes) {
    const candidate = remaining.slice(0, maxGraphemes);
    const whitespaceIndex = candidate.findLastIndex((grapheme) =>
      /\s/u.test(grapheme)
    );
    const splitIndex = whitespaceIndex > 0 ? whitespaceIndex : maxGraphemes;

    parts.push(remaining.slice(0, splitIndex).join("").trimEnd());
    remaining = remaining.slice(splitIndex);
    while (remaining.length > 0 && /^\s$/u.test(remaining[0])) {
      remaining.shift();
    }
  }

  if (remaining.length > 0 || parts.length === 0) {
    parts.push(remaining.join(""));
  }

  return parts;
}
