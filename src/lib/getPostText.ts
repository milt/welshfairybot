import sentences from "../data/welshFairyBook.json" with { type: "json" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const postTexts = sentences.filter(isNonEmptyString);

if (postTexts.length === 0) {
  throw new Error("The Welsh Fairy Book contains no postable sentences.");
}

export default async function getPostText(): Promise<string> {
  const index = Math.floor(Math.random() * postTexts.length);
  return postTexts[index];
}

function normalizeForSearch(text: string): string {
  return text.normalize("NFC").toLocaleLowerCase("en-US");
}

export function getPostTextContaining(
  query: string,
  randomSource: () => number = Math.random,
): string | undefined {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (normalizedQuery.length === 0) {
    return undefined;
  }

  const matches = postTexts.filter((text) =>
    normalizeForSearch(text).includes(normalizedQuery)
  );
  if (matches.length === 0) {
    return undefined;
  }

  const index = Math.floor(randomSource() * matches.length);
  return matches[index];
}
