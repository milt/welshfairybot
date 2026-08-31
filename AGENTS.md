# Welsh Fairy Bot Agent Guide

## Objective

Create a bluesky bot (from this template) that posts snippets from the Welsh Fairy Book by W. Jenkyn Thomas (included in welshFairyBook.json).

## Technical Baseline

- Use NodeJS and TypeScript, already present in the application.
- Use npm for package management.

## Expected Structure

Prefer this small structure unless the existing repository already establishes
an equivalent convention:

- `src/index.ts` - application entry point
- `src/lib/bot.ts` - bot implementation
- `src/lib/config.ts` - bluesky auth/config
- `src/lib/getPostText` - defines the function we will build to get random sentences from welshFairyBook.json
- `src/test/` - add focused automated tests for sentence extraction, no need to test bluesky itself
- `.github/workflows/post.yml` - Github Actions workflow to periodically post

Do not create abstractions, components, or directories that are not justified
by the task.

## Working Method

1. Inspect the repository before changing anything.
2. If an application already exists, adapt it instead of replacing unrelated
   files or scaffolding a second application.
3. Use targeted searches and read only files relevant to the task.
4. Before editing, identify the smallest set of files needed.
5. Implement one coherent slice at a time.
6. Run the narrowest relevant test after each meaningful slice.
7. Run the complete test suite and production build before finishing.
8. Do not repeatedly reread files that have not changed.
9. Do not narrate routine tool use or repeat command output.
10. After two failed attempts at the same problem, stop and report the evidence
    rather than continuing speculative changes.

## Implementation Rules

- The bot operates statelessly, it is OK if it posts the same thing twice.
- Do not use `any` or disable TypeScript/compiler/linter checks to make a build
  pass.
- Do not leave dead code, debug logging, commented-out implementations, or
  placeholder TODO comments.

## Verification

At minimum, automated tests must cover:

- Extracting a sentence with getPostText
Before declaring completion, run:

```bash
npm test -- --run
npm run build
```

If the repository defines different equivalent scripts, use those and explain
the substitution.

## Completion Response

Return only:

- A concise summary of the implementation
- Files created or changed
- Tests and checks run, with outcomes
- Any unmet acceptance criterion or remaining uncertainty

