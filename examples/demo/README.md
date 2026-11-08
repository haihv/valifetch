# valifetch demo

A small Vite app showing valifetch in the browser: an instance with shared
options, response and request-body validation, and typed error handling.
The examples are in [`src/main.ts`](src/main.ts); `src/ui.ts` only wires them
to buttons.

[Open in StackBlitz](https://stackblitz.com/github/haihv/valifetch/tree/main/examples/demo?file=src/main.ts)

Run it locally:

```bash
npm install
npm run dev
```

It installs the published `valifetch` package from npm, not the source in this
repository, so it shows exactly what users get.
