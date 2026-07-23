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

function computeBarSegmentWidths(languages, totalBytes, barWidth) {
  const rawWidths = languages.map(
    (language) => (language.bytes / totalBytes) * barWidth,
  );
  const widths = rawWidths.map((width) => Math.floor(width));
  let remainder = barWidth - widths.reduce((sum, width) => sum + width, 0);

  const ranked = rawWidths
    .map((width, index) => ({ index, fraction: width - widths[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remainder; i += 1) {
    widths[ranked[i % ranked.length].index] += 1;
  }

  return mergeTinyBarSegments(languages, widths, 4);
}

function mergeTinyBarSegments(languages, widths, minPixels) {
  const merged = [...widths];
  const otherIndex = languages.findIndex((language) => language.name === "Other");
  const absorbIndex = otherIndex >= 0 ? otherIndex : merged.length - 1;

  for (let index = 0; index < merged.length; index += 1) {
    if (index === absorbIndex || merged[index] <= 0 || merged[index] >= minPixels) {
      continue;
    }

    merged[absorbIndex] += merged[index];
    merged[index] = 0;
  }

  return merged;
}

function formatPercentLabel(percent) {
  return percent < 10 ? percent.toFixed(1) : String(Math.round(percent));
}

function renderLanguageRow(x, y, language) {
  const color = colorFor(language.name);
  const label = escapeXml(language.name);
  const percent = formatPercentLabel(language.percent);
  const swatchSize = 6;
  const textSize = 11;
  const swatchY = y - textSize + 2;

  return `  <rect x="${x}" y="${swatchY}" width="${swatchSize}" height="${swatchSize}" rx="1.5" fill="${color}"/>
  <text x="${x + swatchSize + 7}" y="${y}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif" font-size="${textSize}">
    <tspan fill="#24292f">${label}</tspan><tspan fill="#8b949e"> ${percent}%</tspan>
  </text>
`;
}

function renderSvg(displayLanguages, totalBytes) {
  const cardWidth = 460;
  const padding = 24;
  const barWidth = cardWidth - padding * 2;
  const rowHeight = 20;
  const columnGap = 40;
  const columnWidth = (barWidth - columnGap) / 2;
  const gridRows = Math.ceil(displayLanguages.length / 2);
  const barY = 44;
  const barHeight = 9;
  const barRadius = 4.5;
  const gridGap = 16;
  const gridTop = barY + barHeight + gridGap;
  const bottomPadding = 20;
  const cardHeight = gridTop + gridRows * rowHeight + bottomPadding;

  const radius = 14;
  const border = 3;
  const innerRadius = radius - border;
  const segmentWidths = computeBarSegmentWidths(
    displayLanguages,
    totalBytes,
    barWidth,
  );

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" role="img" aria-label="Languages" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="metalBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="28%" stop-color="#b6bec8"/>
      <stop offset="52%" stop-color="#eef1f4"/>
      <stop offset="78%" stop-color="#8b96a3"/>
      <stop offset="100%" stop-color="#6d7784"/>
    </linearGradient>
    <filter id="softShadow" x="-6%" y="-6%" width="112%" height="112%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#94a3b8" flood-opacity="0.2"/>
    </filter>
    <clipPath id="barClip">
      <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${barRadius}"/>
    </clipPath>
  </defs>
  <g filter="url(#softShadow)">
    <rect width="${cardWidth}" height="${cardHeight}" rx="${radius}" fill="url(#metalBorder)"/>
    <rect x="${border}" y="${border}" width="${cardWidth - border * 2}" height="${cardHeight - border * 2}" rx="${innerRadius}" fill="#ffffff"/>
  </g>
  <text x="${cardWidth / 2}" y="30" fill="#24292f" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600">Languages</text>
  <g clip-path="url(#barClip)">
    <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="#eef1f4"/>
`;

  let barX = padding;
  displayLanguages.forEach((language, index) => {
    const segmentWidth = segmentWidths[index];
    if (segmentWidth <= 0) return;
    svg += `    <rect x="${barX}" y="${barY}" width="${segmentWidth}" height="${barHeight}" fill="${colorFor(language.name)}"/>\n`;
    barX += segmentWidth;
  });

  svg += `  </g>
  <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${barRadius}" fill="none" stroke="#d0d7de" stroke-width="1"/>
`;

  const leftX = padding;
  const rightX = padding + columnWidth + columnGap;

  displayLanguages.forEach((language, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const x = column === 0 ? leftX : rightX;
    const y = gridTop + row * rowHeight + 13;
    svg += renderLanguageRow(x, y, language);
  });

  svg += `</svg>
`;

  return svg;
}

const previewLanguages = [
  { name: "TeX", bytes: 340, percent: 34 },
  { name: "Python", bytes: 300, percent: 30 },
  { name: "TypeScript", bytes: 150, percent: 15 },
  { name: "JavaScript", bytes: 120, percent: 12 },
  { name: "HTML", bytes: 41, percent: 4.1 },
  { name: "CSS", bytes: 36, percent: 3.6 },
  { name: "C++", bytes: 8, percent: 0.8 },
  { name: "Kotlin", bytes: 5, percent: 0.5 },
  { name: "Rust", bytes: 3, percent: 0.3 },
  { name: "Other", bytes: 6, percent: 0.6 },
];

async function main() {
  if (process.argv.includes("--preview")) {
    const totalBytes = previewLanguages.reduce(
      (sum, language) => sum + language.bytes,
      0,
    );
    const outputPath = path.join(process.cwd(), "profile", "languages.svg");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      renderSvg(previewLanguages, totalBytes),
      "utf8",
    );
    console.log(`Preview written to ${outputPath}`);
    return;
  }

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
  const svg = renderSvg(displayLanguages, totalBytes);

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
