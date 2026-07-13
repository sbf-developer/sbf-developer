const fs = require("fs");
const path = require("path");

const username = "sbf-developer";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

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
  Jupyter: "#DA5B0B",
  Makefile: "#427819",
  Dockerfile: "#384d54",
  Lua: "#000080",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  CSharp: "#178600",
  "C#": "#178600",
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

async function main() {
  const repos = await fetchAllRepos();
  const languageTotals = new Map();

  for (const repo of repos) {
    if (repo.fork) continue;

    const languages = await fetchJson(
      `https://api.github.com/repos/${repo.full_name}/languages`,
    );

    for (const [language, bytes] of Object.entries(languages)) {
      languageTotals.set(
        language,
        (languageTotals.get(language) || 0) + Number(bytes),
      );
    }
  }

  const languages = [...languageTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, bytes }));

  const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);
  const cardWidth = 420;
  const rowHeight = 18;
  const headerHeight = 36;
  const footerHeight = 16;
  const cardHeight =
    headerHeight + languages.length * rowHeight + footerHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
  <rect width="${cardWidth}" height="${cardHeight}" rx="4.5" fill="#0d1117" stroke="#30363d"/>
  <text x="20" y="24" fill="#58a6ff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" font-weight="600">All Languages</text>
`;

  languages.forEach((language, index) => {
    const percent =
      totalBytes > 0
        ? Math.round((language.bytes / totalBytes) * 10000) / 100
        : 0;
    const barWidth = Math.max(2, Math.round(360 * (language.bytes / totalBytes)));
    const y = headerHeight + index * rowHeight;
    const color = colorFor(language.name);
    const label = escapeXml(language.name);

    svg += `  <text x="20" y="${y}" fill="#8b949e" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12">${label}</text>
  <text x="${cardWidth - 20}" y="${y}" fill="#8b949e" text-anchor="end" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12">${percent}%</text>
  <rect x="20" y="${y + 4}" width="360" height="8" rx="4" fill="#161b22"/>
  <rect x="20" y="${y + 4}" width="${barWidth}" height="8" rx="4" fill="${color}"/>
`;
  });

  svg += `  <text x="20" y="${cardHeight - 6}" fill="#6e7681" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="10">${languages.length} languages across public repositories</text>
</svg>
`;

  const outputPath = path.join(process.cwd(), "profile", "languages.svg");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, svg, "utf8");

  console.log(`Generated ${languages.length} languages (${totalBytes} total bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
