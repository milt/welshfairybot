import { describe, expect, it, vi } from "vitest";
import GitHubActionsVariableState from "../lib/githubActionsVariableState.js";

const nextPostAt = "2026-09-01T15:00:00.000Z";

function stateWith(fetchImplementation: typeof fetch) {
  return new GitHubActionsVariableState({
    token: "test-token",
    repository: "owner/repository",
    apiUrl: "https://api.github.test",
    fetchImplementation,
  });
}

describe("GitHubActionsVariableState", () => {
  it("updates and verifies an existing variable", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ value: nextPostAt }));

    await expect(stateWith(fetchImplementation).write(nextPostAt)).resolves
      .toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls[0][1]?.method).toBe("PATCH");
    expect(fetchImplementation.mock.calls[1][1]?.method).toBeUndefined();
  });

  it("creates and verifies a missing variable", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ value: nextPostAt }));

    await expect(stateWith(fetchImplementation).write(nextPostAt)).resolves
      .toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(fetchImplementation.mock.calls[1][1]?.method).toBe("POST");
  });

  it("fails when the persisted value cannot be verified", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ value: "different-value" }));

    await expect(stateWith(fetchImplementation).write(nextPostAt)).rejects
      .toThrow("Could not verify persisted NEXT_POST_AT.");
  });
});
