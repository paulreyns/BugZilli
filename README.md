# Bugzilli

A focused desktop client for browsing Bugzilla issues. Bugzilli provides a
Jira-inspired list, status board, and bug detail view while keeping Bugzilla as
the only source of data.

## Features

- Configure any Bugzilla REST API URL and optional API key
- Map sidebar projects to Bugzilla products
- Search and refresh project issues
- Browse issues in a table or status-grouped board
- View the description near the top of each bug
- Browse comments and attachments in separate tabs
- Open attachments through the system browser

The API key is encrypted with Electron `safeStorage` when the operating system
credential store is available. Settings are saved in Electron's per-user
application data directory, not in this repository.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

To build and launch the production renderer locally:

```bash
npm start
```

## Bugzilla API

Bugzilli uses the standard Bugzilla REST endpoints:

- `GET /rest/bug` for project lists and searches
- `GET /rest/bug/:id` for bug details
- `GET /rest/bug/:id/comment` for the description and comments
- `GET /rest/bug/:id/attachment` for attachment metadata

Requests with a configured key send it through the `X-BUGZILLA-API-KEY`
header. Instances that allow anonymous reads can be used without a key.
