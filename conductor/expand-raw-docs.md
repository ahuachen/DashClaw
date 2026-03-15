# Plan: Expand Raw Documentation Context

The current `/api/docs/raw` route only returns the content of `sdk/README.md`. This is too summarized for LLMs that need more context about the DashClaw platform. This plan will update the route to aggregate several high-value documentation files into a single markdown response.

## Objective
Provide a comprehensive markdown document containing SDK usage, architecture, API inventory, and security model.

## Key Files & Context
- `app/api/docs/raw/route.js`: The API route providing the raw markdown content.
- Documentation sources:
  - `sdk/README.md`
  - `README.md` (root)
  - `docs/FULL_CONTEXT.md`
  - `docs/api-inventory.md`
  - `docs/SECURITY.md`
  - `docs/architecture/capabilities.md`
  - `docs/architecture/runtime-api.md`

## Implementation Steps

1. **Update `app/api/docs/raw/route.js`**:
   - Define an array of documentation file paths relative to `process.cwd()`.
   - Iterate through the files and read their content.
   - Use `fs.existsSync` for each file read to ensure a single missing file doesn't break the entire response.
   - Concatenate the contents with clear separator headers and horizontal rules.
   - Return the combined content as a `text/markdown` response.

2. **Verification**:
   - Manually trigger a fetch to `/api/docs/raw`.
   - Ensure all requested files are present and properly separated.

## Proposed Code Change

```javascript
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const filesToInclude = [
    { name: 'SDK README', path: 'sdk/README.md' },
    { name: 'Root README', path: 'README.md' },
    { name: 'Full Context', path: 'docs/FULL_CONTEXT.md' },
    { name: 'API Inventory', path: 'docs/api-inventory.md' },
    { name: 'Security Guide', path: 'docs/SECURITY.md' },
    { name: 'Architecture Capabilities', path: 'docs/architecture/capabilities.md' },
    { name: 'Runtime API', path: 'docs/architecture/runtime-api.md' },
  ];

  try {
    let combinedContent = '';

    for (const file of filesToInclude) {
      const filePath = resolve(process.cwd(), file.path);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        combinedContent += `\n\n--- DOCUMENT: ${file.name} (${file.path}) ---\n\n`;
        combinedContent += content;
      }
    }

    if (!combinedContent) {
      return NextResponse.json({ error: 'Documentation not found' }, { status: 404 });
    }

    return new Response(combinedContent.trim(), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error reading documentation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```
