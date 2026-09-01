interface GitHubActionsVariableStateOptions {
  variableName: string;
  token: string;
  repository: string;
  apiUrl: string;
  fetchImplementation?: typeof fetch;
}

export default class GitHubActionsVariableState {
  readonly #token: string;
  readonly #variableUrl: string;
  readonly #variablesUrl: string;
  readonly #fetch: typeof fetch;
  readonly #variableName: string;

  constructor({
    variableName,
    token,
    repository,
    apiUrl,
    fetchImplementation = fetch,
  }: GitHubActionsVariableStateOptions) {
    this.#variableName = variableName;
    this.#token = token;
    this.#variablesUrl = `${apiUrl}/repos/${repository}/actions/variables`;
    this.#variableUrl = `${this.#variablesUrl}/${variableName}`;
    this.#fetch = fetchImplementation;
  }

  #headers(): HeadersInit {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.#token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async read(): Promise<string | undefined> {
    const response = await this.#fetch(this.#variableUrl, {
      headers: this.#headers(),
    });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`Failed to read ${this.#variableName}: HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("value" in body) ||
      typeof body.value !== "string"
    ) {
      throw new Error(`GitHub returned an invalid ${this.#variableName} value.`);
    }
    return body.value;
  }

  async write(value: string): Promise<void> {
    const updateResponse = await this.#fetch(this.#variableUrl, {
      method: "PATCH",
      headers: { ...this.#headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: this.#variableName, value }),
    });

    if (updateResponse.status === 404) {
      const createResponse = await this.#fetch(this.#variablesUrl, {
        method: "POST",
        headers: { ...this.#headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: this.#variableName, value }),
      });
      if (!createResponse.ok) {
        throw new Error(
          `Failed to create ${this.#variableName}: HTTP ${createResponse.status}.`,
        );
      }
    } else if (!updateResponse.ok) {
      throw new Error(
        `Failed to update ${this.#variableName}: HTTP ${updateResponse.status}.`,
      );
    }

    const persistedValue = await this.read();
    if (persistedValue !== value) {
      throw new Error(`Could not verify persisted ${this.#variableName}.`);
    }
  }
}
