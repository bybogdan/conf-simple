# Contributing

Thanks for helping improve Pagecairn. The project is intentionally focused: a
small, self-hosted wiki for software teams.

## Before starting

- Search existing issues and pull requests before opening a new one.
- For a bug, include the version, deployment method, reproduction steps,
  expected behavior, and relevant logs with secrets and personal data removed.
- Discuss substantial features before implementing them. Features outside the
  scope described in `AGENTS.md` are unlikely to be accepted.
- Report security issues privately as described in `SECURITY.md`.

## Development

Use Node.js 22 or newer:

```bash
npm install
npm run dev
```

Before submitting a pull request, run:

```bash
npm test
npm run build
```

Keep changes small and focused. Add meaningful tests for behavior changes,
preserve the SQLite and local-file defaults, and update user documentation when
commands or configuration change.

## Pull requests

Explain what changed, why it is needed, how it was verified, and any migration
or deployment impact. By contributing, you agree that your contribution is
licensed under the repository's MIT License.
