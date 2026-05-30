# Testing

ZombieSheet uses [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react/) for unit and hook/component tests.

## Commands

```bash
npm test              # run once (CI)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

## Conventions

- Colocate tests as `*.test.ts` / `*.test.tsx` next to the module under test.
- Prefer pure unit tests for logic in `src/utils/` and `src/types/`.
- Mock Firebase at `@/config/firebase` or `firebase/firestore` — never call live Firebase in tests.
- For components that use i18n, use `renderWithProviders` from `src/test/render.tsx`.
- Assert i18n **keys** when functions return keys (e.g. dice outcomes), not translated strings.

## Adding tests for new logic

When adding non-trivial pure logic, add or extend a colocated `*.test.ts` in the same PR.
