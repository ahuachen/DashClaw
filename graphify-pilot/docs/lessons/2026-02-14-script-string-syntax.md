# Lesson: Avoid Raw Newlines Inside Quoted JS Strings

## What Failed

Some scripts accidentally contained raw line breaks inside single-quoted strings, for example:

```js
console.log('
message');
```

This is invalid JavaScript and throws `SyntaxError: Invalid or unexpected token`.

## Safe Patterns

Use one of these patterns instead:

```js
console.log('\nmessage');
console.log(`\nmessage`);
```

For multiline generated text (PEM, curl examples, etc.), prefer template literals or explicit `\n` joins.

## Guardrail Added

Run this before commit/PR:

```bash
npm run scripts:check-syntax
```

This command parses every `.js/.mjs` file in `scripts/` and fails fast on syntax errors.
