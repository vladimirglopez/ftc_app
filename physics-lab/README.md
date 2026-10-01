# Physics Lab — Falling Motion with Photogates

Client-side web app for high-school photogate experiments. No accounts, server, or database; everything stays in the browser and builds to a static site.

**Status:** stages 1–4 done: project structure, data models, tested analysis, simulated photogate source. The student UI is not built yet.

```bash
npm install
npm test        # Vitest unit tests
npm run build   # type-check + static build into dist/
npm run dev     # local dev server
```

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Vernier hardware notes and open questions: [docs/VERNIER_INTEGRATION.md](docs/VERNIER_INTEGRATION.md)
