const PUBLISHED_STABLE_ROW =
  /^\|\s*`(\d+)\.(\d+)\.(\d+)`\s*\|\s*stable record\s*\|/gm;

function compareSemverParts(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

export function findLatestStableRelease(changelog, releaseIndex) {
  let latest;

  for (const match of releaseIndex.matchAll(PUBLISHED_STABLE_ROW)) {
    const parts = match.slice(1, 4).map(Number);
    if (!latest || compareSemverParts(parts, latest.parts) > 0) {
      latest = {
        version: parts.join("."),
        parts,
      };
    }
  }

  if (!latest) {
    throw new Error(
      "No published stable release found in spec/releases/README.md",
    );
  }

  const escapedVersion = latest.version.replaceAll(".", String.raw`\.`);
  const datedHeading = changelog.match(
    new RegExp(
      String.raw`^## \[${escapedVersion}\] - (\d{4}-\d{2}-\d{2})\s*$`,
      "m",
    ),
  );
  if (!datedHeading) {
    throw new Error(
      `No dated changelog entry found for published stable ${latest.version}`,
    );
  }

  return {
    version: latest.version,
    date: datedHeading[1],
  };
}
