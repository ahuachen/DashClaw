#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([".git", ".next", "node_modules", ".vercel"]);
const DOC_EXT = ".md";

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(DOC_EXT)) {
      files.push(fullPath);
    }
  }

  return files;
}

function isExternalLink(link) {
  return /^(?:[a-z]+:|mailto:|tel:)/i.test(link);
}

function normalizeLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target) return target;

  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  }

  // Drop optional title if present: path "title"
  if (!target.startsWith("http") && /\s+"/.test(target)) {
    target = target.split(/\s+"/, 1)[0];
  }

  return target;
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

function stripFencedCodeBlocks(content) {
  // Remove fenced code blocks so inline code like `[fn](arg)` isn't treated as a link
  return content.replace(/^`{3,}[^\n]*\n[\s\S]*?^`{3,}\s*$/gm, "");
}

async function validateLinks(markdownFile, content) {
  const errors = [];
  const regex = /!?\[[^\]]*]\(([^)]+)\)/g;
  const fileDir = path.dirname(markdownFile);
  content = stripFencedCodeBlocks(content);
  let match;

  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1];
    const target = normalizeLinkTarget(rawTarget);
    if (!target || target.startsWith("#") || isExternalLink(target)) continue;

    const [pathPart] = target.split("#");
    if (!pathPart) continue;

    const cleanPath = pathPart.split("?")[0];
    if (!cleanPath) continue;

    // Skip absolute route-style links (e.g. /demo, /api/docs/raw) that refer
    // to Next.js pages or API endpoints, not filesystem resources.
    if (cleanPath.startsWith("/") && !path.extname(cleanPath)) continue;

    const resolved = cleanPath.startsWith("/")
      ? path.join(ROOT, cleanPath.slice(1))
      : path.resolve(fileDir, cleanPath);

    const existsDirect = await pathExists(resolved);
    const existsMarkdown = await pathExists(`${resolved}.md`);
    if (existsDirect || existsMarkdown) continue;

    errors.push(`${path.relative(ROOT, markdownFile)} -> ${target}`);
  }

  return errors;
}

function extractNextJsMajor(pkgJson) {
  const nextVersion = pkgJson.dependencies?.next || pkgJson.devDependencies?.next;
  if (!nextVersion) {
    throw new Error("Could not find next version in package.json");
  }

  const majorMatch = String(nextVersion).match(/(\d+)/);
  if (!majorMatch) {
    throw new Error(`Could not parse Next.js major from version: ${nextVersion}`);
  }

  return Number(majorMatch[1]);
}

function validateNextVersionMentions(filePath, content, expectedMajor) {
  const errors = [];
  const regex = /Next\.js\s+(\d+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const foundMajor = Number(match[1]);
    if (foundMajor !== expectedMajor) {
      errors.push(
        `${path.relative(ROOT, filePath)} -> mentions Next.js ${foundMajor}, expected Next.js ${expectedMajor}`
      );
    }
  }

  return errors;
}

async function main() {
  const markdownFiles = await walk(ROOT);
  const linkErrors = [];
  for (const filePath of markdownFiles) {
    const content = await fs.readFile(filePath, "utf8");
    linkErrors.push(...(await validateLinks(filePath, content)));
  }

  const packageJson = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  const nextMajor = extractNextJsMajor(packageJson);

  const versionCheckFiles = [
    path.join(ROOT, "README.md"),
    path.join(ROOT, "CONTRIBUTING.md"),
    path.join(ROOT, "PROJECT_DETAILS.md"),
  ];

  const versionErrors = [];
  for (const filePath of versionCheckFiles) {
    const content = await fs.readFile(filePath, "utf8");
    versionErrors.push(...validateNextVersionMentions(filePath, content, nextMajor));
  }

  if (linkErrors.length === 0 && versionErrors.length === 0) {
    console.log("docs validation passed");
    return;
  }

  if (linkErrors.length > 0) {
    console.error("Broken markdown links found:");
    for (const err of linkErrors) console.error(`- ${err}`);
  }

  if (versionErrors.length > 0) {
    console.error("Version consistency issues found:");
    for (const err of versionErrors) console.error(`- ${err}`);
  }

  process.exitCode = 1;
}

main().catch((err) => {
  console.error(`docs validation failed: ${err.message}`);
  process.exitCode = 1;
});
