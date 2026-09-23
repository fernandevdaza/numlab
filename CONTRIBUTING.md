<p align="right"><b>English</b> · <a href="CONTRIBUTING.es.md">Español</a></p>

# Contributing to NumLab

Thanks for helping improve NumLab! It is made by and for students of numerical methods.

## Setup

Requirements: Node.js 22+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # opens http://localhost:5173
```

Before sending changes:

```bash
pnpm build        # type-checks (tsc) and builds
pnpm test         # TeX formulas, plot fidelity and numerical verification
```

## Structure

| Folder | Contents |
|---|---|
| `src/modules/<topic>/` | One module per course topic. Each exports a `topic` (see `src/modules/types.ts`) with its methods. |
| `src/modules/<topic>/algorithms.ts` | **Pure** algorithms (no React): easy to test with Node. |
| `src/components/` | Shared UI (`MethodPage`, `DataTable`, `ScilabCode`, `Plot`…). |
| `src/lib/` | Utilities: expressions (mathjs), number formatting, plot sampling. |
| `src/i18n.ts` | English/Spanish interface. |
| `scripts/verificar/` | Numerical verification tests, run with Node. |

## Adding a method

1. Write the algorithm as a pure function in `algorithms.ts` and check it against a known result (textbook, closed
   form) with a test in `scripts/verificar/<topic>.ts`.
2. Build the page with `MethodPage`: parameters, results, iteration table, **step by step** with the numbers plugged
   in, and the equivalent **Scilab** code.
3. Register it in the topic's `index.ts` (with `group`, `summary` and `keywords` in both languages).

## Guidelines

- **Correctness first:** every result must be checkable by hand or with Scilab. When a definition differs between
  books, state which one is used and, if possible, offer the other as an option.
- **Bilingual:** every visible string goes through `L('texto en español', 'English text')` (see `src/i18n.ts`); it
  also works with JSX: `L(<>…</>, <>…</>)`. Math notation uses KaTeX. Inside JS strings, TeX needs double
  backslashes (`'\\frac'`, `'\;'`); `pnpm test:tex` catches mistakes.
- **Copyright:** don't copy text from books; explain in your own words. Citing an example number and using its
  numeric data is fine.

## Reporting bugs

Open an issue with: the page (URL with `#/topic/method`), the input you used, the result you got and the one you
expected (with its source, if it comes from a book).
