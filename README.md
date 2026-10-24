# Open File

An independent chess game review application built with React, TypeScript, Vite, chess.js, and local Stockfish 19 Lite. Choose a Chess.com username, import its public game history, and review a game in your browser. A complete Opera Game sample is included.

[Open the private app](https://open-file-chess-review.woolly-rice-1868.chatgpt.site) with your ChatGPT account. Browser and automated verification results are recorded in [verification.md](docs/verification.md).

## Run locally

Use Node.js 22.12 or newer, or Node.js 20.19 or newer in the 20.x release line, with npm.

```sh
cd chess-review
npm ci
npm run dev
```

Open the local URL printed by Vite. The dev script prepares the JavaScript, WebAssembly, and license files served from `public/engine/`.

```sh
npm test
npm run build
npm run preview
```

Tests cover archive importing, cancellation and cache races, legal PGN replay, review scoring, reports, UCI handling, and the real bundled engine. `build` typechecks the application, copies the engine assets, and produces `chess-review/dist/`. `preview` serves that production build locally. Deploy the contents of `dist/` to a static host that serves JavaScript and WebAssembly with their appropriate MIME types.

## Use the application

Enter a Chess.com username in the game library and select **Import all games**. Search or filter the results by player, time control, result, or month; use pagination to browse the full library. Select a game and start its review. You can also load a PGN or explore the sample without importing an account.

The application currently provides:

- Full-game engine review with progress, cancellation, adjustable depth and time per position, per-player accuracy, move counts, key moments, and opening/middlegame/endgame summaries.
- Independent Brilliant, Great, Book, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Missed opportunity, and Forced classifications, with explanations and a visible scoring-method description.
- Opening, tactics, strategy, and endgame category summaries calculated from the reviewed moves.
- Guided move-by-move review and optional spoken explanations using installed local browser voices when available.
- Board replay, clocks from PGN annotations, orientation controls, keyboard navigation, legal move input with promotion, and right-click board annotations.
- An evaluation bar and interactive graph, three candidate engine lines, playable variations, and return to the recorded game.
- Continue any analyzed position against Stockfish, choose a side, undo a turn, or restart the continuation.
- Explore every imported standard game for continuations from the current position, including transpositions, move frequencies, results, and average player ratings.
- Retry practice for inaccuracies, mistakes, blunders, and missed opportunities, with player selection, hints, and the engine's recorded best-move solution.
- Original PGN export, annotated review PGN export, and a plain-text report.
- Local saved game libraries and completed reviews through IndexedDB; review settings use localStorage.

## Public archives and local data

The importer calls `https://api.chess.com/pub/player/{username}/games/archives`, then requests every monthly archive returned by that index, newest first. It makes sequential requests, retries temporary network/server failures and rate limits, reports progress, supports Stop, and deduplicates games by their public game URL. There is no application backend, client authentication, Chess.com login, or API key.

“All games” means all games exposed by the public API's returned archive list. Private, deleted, unpublished, or otherwise unavailable games cannot be recovered through that API. API availability and rate limits affect imports; large histories can take time.

A complete saved library loads when you import that username again, while the application checks every archive for updates. Newly loaded batches are usable immediately. If you stop an import or it fails, its partial results remain in the current session; they do not overwrite the last complete saved library. Only a successfully completed import replaces the saved history. Storage failures are shown in the interface, and clearing browser site data removes local libraries, settings, and reviews.

Game analysis runs locally in a Web Worker. Importing a username sends that public username to Chess.com's public API. Voice playback offers only voices reported by the browser as local services.

## Architecture

All application paths below are relative to `chess-review/`.

| Module | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/hooks/useWorkspace.ts` | Workspace presentation and state, selected game and position, variations, review/analysis/practice modes. |
| `src/components/` | Board, library, move list, review reports, graph, guided coach, practice, and dialogs. |
| `src/lib/chesscom.ts` | Public archive import, response validation, retries, progress, and cancellation. |
| `src/lib/game.ts`, `demo.ts` | PGN parsing, legal move/FEN history, clocks, game records, and the sample game. |
| `src/engine/` | Stockfish worker lifecycle, UCI parsing, normalized evaluations, and position analysis. |
| `src/lib/review.ts`, `review-metrics.ts`, `openings.ts` | Full-game review, independent classifications and accuracy, phase detection, and a small local opening book. |
| `src/lib/report.ts` | Category summaries, annotated PGN, and plain-text report generation. |
| `src/lib/insights.ts`, `explorer.ts`, `play-position.ts` | Rule-based coaching, full-library position exploration, and engine continuation state. |
| `src/lib/storage.ts` | IndexedDB libraries/reviews and text downloads. |
| `src/hooks/` | Import/review lifecycle, caching, request ownership, and cancellation. |
| `scripts/copy-engine.mjs` | Copies the selected npm engine distribution and license into the static assets. |

## Method and current limits

Accuracy is an independent score: each move receives `100 × exp(−centipawn loss / 250)`, and player accuracy averages those move scores. Classifications, Brilliant/Great heuristics, phase boundaries, key-moment selection, and category summaries are this application's own methods. They are not Chess.com's proprietary scoring formulas and are not evidence of equivalent results. Engine depth and time settings affect the results.

The opening naming book contains a small set of explicit local lines. The separate opening explorer searches the imported library; it does not provide a worldwide master-game database. Category scores describe eligible moves in one reviewed game; they are not calibrated skill ratings. Elo or single-game rating prediction is not implemented.

Engine review supports standard chess only. Other variants returned by the archive API are retained in the library and can be exported as their original PGN, with an explicit unsupported-review message.

Chess.com's private or paid coach backend, proprietary explanations and personalities, tablebases, cloud saved-analysis services, shared analysis rooms, and recommended training are not implemented. Full parity has not been established. The [REA investigation and feature/gap ledger](docs/chess-com-review-research.md) records the observed client surface, evidence boundaries, and requirements for further comparison.

The application source and SVG artwork are independently written. No captured Chess.com client source, proprietary assets, or coach media are copied into this application. Public game PGNs are fetched through the public API. The separately distributed open-source engine is identified below.

## Stockfish distribution and source

The application pins the npm package [`stockfish@19.0.1`](https://www.npmjs.com/package/stockfish/v/19.0.1) and uses its `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm` files. This is the single-threaded Lite build; it does not require cross-origin isolation headers. It is distinct from the larger full-network Stockfish build.

Stockfish.js is distributed under GPL-3.0. Its bundled license is copied from the package's `Copying.txt` to `public/engine/COPYING.txt` and included in the production build. The upstream project is [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js), based on [Stockfish](https://github.com/official-stockfish/Stockfish).

Version-specific upstream source: [v19.0.1 release](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1), [source tree at commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6), and [source archive](https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz). That commit is the peeled upstream `v19.0.1` tag, verified with `git ls-remote`. The npm package metadata does not publish a `gitHead`; the source commit is therefore identified by the matching upstream release tag, not an npm-reported commit. The exact installed npm artifact is pinned by `package-lock.json` integrity and is available as the [19.0.1 package tarball](https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz).
