import fs from "fs";
import path from "path";

const username = "sbf-developer";
const token = process.env.GITHUB_TOKEN;
const MIN_PERCENT = 0.3;

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "sbf-developer-profile-stats",
};

const colors = {
  Python: "#3572A5",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  TeX: "#3D6117",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Kotlin: "#A97BFF",
  Rust: "#dea584",
  Go: "#00ADD8",
  Shell: "#89e051",
  C: "#555555",
  "C++": "#f34b7d",
  Java: "#b07219",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Dart: "#00B4AB",
  R: "#198CE7",
  SCSS: "#c6538c",
  Vue: "#41b883",
  "Jupyter Notebook": "#DA5B0B",
  Makefile: "#427819",
  Dockerfile: "#384d54",
  Lua: "#000080",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  "C#": "#178600",
  GDScript: "#355570",
  NSIS: "#40AA53",
  Other: "#484f58",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchAllRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    const batch = await fetchJson(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`,
    );
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return repos;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colorFor(language) {
  return colors[language] || "#8b949e";
}

function formatPercent(bytes, total) {
  return total > 0 ? Math.round((bytes / total) * 1000) / 10 : 0;
}

function buildDisplayLanguages(languages, totalBytes) {
  const visible = [];
  let otherBytes = 0;

  for (const language of languages) {
    const percent = formatPercent(language.bytes, totalBytes);
    if (percent >= MIN_PERCENT) {
      visible.push({ ...language, percent });
    } else {
      otherBytes += language.bytes;
    }
  }

  if (otherBytes > 0) {
    visible.push({
      name: "Other",
      bytes: otherBytes,
      percent: formatPercent(otherBytes, totalBytes),
    });
  }

  return visible;
}

function renderLanguageRow(x, y, width, language) {
  const color = colorFor(language.name);
  const label = escapeXml(language.name);
  const percent = language.percent.toFixed(language.percent < 10 ? 1 : 0);

  return `  <circle cx="${x + 5}" cy="${y - 4}" r="4" fill="${color}"/>
  <text x="${x + 14}" y="${y}" fill="#c9d1d9" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12">${label}</text>
  <text x="${x + width - 4}" y="${y}" fill="#8b949e" text-anchor="end" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12">${percent}%</text>
`;
}

async function main() {
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }

  const repos = await fetchAllRepos();
  const languageTotals = new Map();

  for (const repo of repos) {
    if (repo.fork) continue;

    const repoLanguages = await fetchJson(
      `https://api.github.com/repos/${repo.full_name}/languages`,
    );

    for (const [language, bytes] of Object.entries(repoLanguages)) {
      languageTotals.set(
        language,
        (languageTotals.get(language) || 0) + Number(bytes),
      );
    }
  }

  const languages = [...languageTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, bytes }));

  const totalBytes = languages.reduce((sum, language) => sum + language.bytes, 0);
  const displayLanguages = buildDisplayLanguages(languages, totalBytes);

  const cardWidth = 460;
  const padding = 24;
  const barWidth = cardWidth - padding * 2;
  const rowHeight = 24;
  const columnGap = 28;
  const columnWidth = (barWidth - columnGap) / 2;
  const gridRows = Math.ceil(displayLanguages.length / 2);
  const barY = 48;
  const barHeight = 10;
  const gridGap = 22;
  const gridTop = barY + barHeight + gridGap;
  const bottomPadding = 20;
  const cardHeight = gridTop + gridRows * rowHeight + bottomPadding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" role="img" aria-label="Languages">
  <defs>
    <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#161b22"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="${cardWidth}" height="${cardHeight}" rx="12" fill="url(#cardGlow)" stroke="#30363d"/>
  <text x="${cardWidth / 2}" y="34" fill="#e6edf3" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="600">Languages</text>
  <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="5" fill="#21262d"/>
`;

  let barX = padding;
  for (const language of displayLanguages) {
    const segmentWidth = Math.max(
      language.name === "Other" ? 2 : 3,
      Math.round((language.bytes / totalBytes) * barWidth),
    );
    svg += `  <rect x="${barX}" y="${barY}" width="${segmentWidth}" height="${barHeight}" rx="0" fill="${colorFor(language.name)}"/>\n`;
    barX += segmentWidth;
  }

  svg += `  <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="5" fill="none" stroke="#30363d" stroke-width="1"/>\n`;

  const leftX = padding;
  const rightX = padding + columnWidth + columnGap;

  displayLanguages.forEach((language, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const x = column === 0 ? leftX : rightX;
    const y = gridTop + row * rowHeight + 16;
    svg += renderLanguageRow(x, y, columnWidth, language);
  });

  svg += `</svg>
`;

  const outputPath = path.join(process.cwd(), "profile", "languages.svg");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, svg, "utf8");

  console.log(
    `Generated ${displayLanguages.length} display languages (${languages.length} total, ${totalBytes} bytes)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
