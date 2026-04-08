---
source-of-truth: false
owner: API Governance Lead
last-verified: 2026-02-13
doc-type: architecture
---

# API Contract Template

Shared route-contract pattern for `app/api/**/route.js` handlers.

## Goals

- Single validation style for request bodies.
- Consistent error shape for validation failures.
- Reusable schemas across routes and SDK docs.

## File Layout

- Contracts:
  - `app/lib/contracts/http.js` for shared parse/validation helpers.
  - `app/lib/contracts/<domain>.js` for zod schemas per API domain.
- Route:
  - `app/api/<domain>/route.js` imports contract schema and helper.

## Template

```javascript
import { NextResponse } from 'next/server';
import { parseJsonWithSchema } from '../../lib/contracts/index.js';
import { exampleCreateSchema } from '../../lib/contracts/example.js';

export async function POST(request) {
  const parsed = await parseJsonWithSchema(request, exampleCreateSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const data = parsed.data;

  // Domain logic here
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
```

## Validation Error Contract

Validation failure responses should return:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "field_name",
      "code": "invalid_type",
      "message": "Expected string, received number"
    }
  ]
}
```

## Reference Implementation

- Route using this template: `app/api/notifications/route.js`
- Domain schema for this route: `app/lib/contracts/notifications.js`
