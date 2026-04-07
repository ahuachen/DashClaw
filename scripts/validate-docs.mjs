#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  collectTrackedMarkdownFiles,
  extractNextJsMajor,
  validateLinks,
  validateNextVersionMentions,
} from "./lib/docs-validator.mjs";

const ROOT = process.cwd();

async function main() {
  const markdownFiles = await collectTrackedMarkdownFiles({ root: ROOT });
  const linkErrors = [];
  for (const filePath of markdownFiles) {
    const content = await fs.readFile(filePath, "utf8");
    linkErrors.push(...(await validateLinks(ROOT, filePath, content)));
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
    versionErrors.push(...validateNextVersionMentions(ROOT, filePath, content, nextMajor));
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
