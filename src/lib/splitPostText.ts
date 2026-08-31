export const MAX_POST_GRAPHEMES = 300;
const CONTINUATION_MARKER = "…";

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
  if (remaining.length <= maxGraphemes) {
    return [text];
  }
  if (maxGraphemes < 3) {
    throw new RangeError("maxGraphemes must be at least 3 when splitting text.");
  }

  const parts: string[] = [];
  let isFirstPart = true;

  while (remaining.length > 0) {
    const prefix = isFirstPart ? "" : CONTINUATION_MARKER;
    const finalPartCapacity = maxGraphemes - toGraphemes(prefix).length;

    if (remaining.length <= finalPartCapacity) {
      parts.push(`${prefix}${remaining.join("")}`);
      break;
    }

    const contentCapacity = finalPartCapacity - 1;
    const candidate = remaining.slice(0, contentCapacity);
    const whitespaceIndex = candidate.findLastIndex((grapheme) =>
      /\s/u.test(grapheme)
    );
    const splitIndex = whitespaceIndex > 0 ? whitespaceIndex : contentCapacity;

    const content = remaining.slice(0, splitIndex).join("").trimEnd();
    parts.push(`${prefix}${content}${CONTINUATION_MARKER}`);
    remaining = remaining.slice(splitIndex);
    while (remaining.length > 0 && /^\s$/u.test(remaining[0])) {
      remaining.shift();
    }
    isFirstPart = false;
  }

  return parts;
}
