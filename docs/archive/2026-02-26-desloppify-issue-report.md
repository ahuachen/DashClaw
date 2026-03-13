# Desloppify Upstream Issue Drafts (2026-02-26)

Repository to file against: `https://github.com/peteromalley/desloppify`

## Issue 1: `desloppify[full]` extra not provided by PyPI package

### Title
PyPI package warns that `desloppify[full]` extra does not exist

### Reproduction
```bash
py -m pip install --upgrade "desloppify[full]"
```

### Actual
Install succeeds for `desloppify`, but pip prints:
`WARNING: desloppify 0.7.2 does not provide the extra 'full'`

### Expected
Either:
- the `full` extra is published and installable, or
- docs/CLI guidance no longer recommends `desloppify[full]`.

### Environment
- OS: Windows
- Python: 3.12.10
- pip: 25.3
- desloppify: 0.7.2

## Issue 2: `--version` UX is confusing

### Title
`py -m desloppify --version` fails with “command required”

### Reproduction
```bash
py -m desloppify --version
```

### Actual
CLI returns usage and:
`error: the following arguments are required: command`

### Expected
Top-level version flag should print version and exit cleanly, or docs should clearly state a different version command.

### Environment
- OS: Windows
- Python: 3.12.10
- desloppify: 0.7.2

## Optional extra context to include

- This happened while running a full scan/resolution loop in a JavaScript codebase with persistent state.
- `update-skill codex`, `scan`, `status`, and `next` otherwise worked.
