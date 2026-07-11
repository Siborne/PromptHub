export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

export function makeRegistrySkill(
  slug: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    slug,
    source_id: `source-${slug}`,
    name: slug
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    description: `${slug} description`,
    category: "general",
    author: "PromptHub",
    source_url: `https://example.com/${slug}`,
    tags: [],
    version: "1.0.0",
    content: `# ${slug}`,
    ...overrides,
  } as never;
}

export function makeSkillsShLeaderboard(count: number) {
  return `
    <main>
      ${Array.from(
        { length: count },
        (_, index) => `
          <a href="/demo/skills/skill-${index + 1}">
            <span>${index + 1}</span>
            <span>skill-${index + 1}</span>
            <span>demo/skills</span>
            <span>${1000 - index}</span>
          </a>
        `,
      ).join("\n")}
    </main>
    <script>self.__next_f.push([1, '\\"totalSkills\\":${count}'])</script>
  `;
}

export function makeSkillsShDetail(skillName: string) {
  return `
    <article>
      <h1>${skillName}</h1>
      <h2>Summary</h2>
      <p>${skillName} helps users run a realistic workflow.</p>
      <h2>SKILL.md</h2>
      <pre><code>---
name: ${skillName}
description: ${skillName} helps users run a realistic workflow.
tags: [demo, test]
---

# ${skillName}
      </code></pre>
    </article>
  `;
}
