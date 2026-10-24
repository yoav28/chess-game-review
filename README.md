# Open File

An independent chess review application built with React, TypeScript, Vite, chess.js, a Chess960 rules adapter using chessops, and local Stockfish 19 Lite. Choose a Chess.com username, import every available public archive, and review standard or Chess960 games in your browser. An Opera Game sample is included.

The latest work is local. The [previous private deployment](https://open-file-chess-review.woolly-rice-1868.chatgpt.site) is an older release and has not been updated with the features below. No current changes have been pushed or redeployed. See [verification.md](docs/verification.md) for recorded checks and their limits.

## Run locally

Use Node.js 22.12 or newer, or Node.js 20.19 or newer in the 20.x release line, with npm.

```sh
cd chess-review
npm ci
npm run dev
```

Open the local URL printed by Vite. The dev script prepares the engine JavaScript, WebAssembly, license, and source information in `public/engine/`.

```sh
npm test
npm run build
npm run preview
```

Tests cover public archive import, cancellation and stale requests, standard and Chess960 legality, actual bundled-engine analysis, scoring, explanations, practice, training, historical model separation, tablebase responses, opening-data integrity, and exports. `build` typechecks the app, copies engine assets, and produces `chess-review/dist/`. `preview` serves that production build locally.

## Use the application

Enter a Chess.com username in the library and choose **Import all games**. Search or filter by player, time control, result, or month. Select a game and start its review. You can also load one PGN game or a FEN position.

The application provides:

- Full-game Stockfish review with progress, cancellation, adjustable depth/time, per-player accuracy, classifications, key moments, and opening/middlegame/endgame reports.
- Standard chess and Chess960 replay, review, variations, engine continuation, and reviewed PGN export. Chess960 uses king-to-rook engine UCI for castling while showing the physical king/rook destinations correctly.
- Board clocks, estimated time spent where sufficient PGN clock/control data exists, promotion choices, orientation and keyboard controls, right-click arrows/circles, and classification highlights.
- Evaluation bar/graph, three candidate lines, playable variations, and return to the recorded game.
- Guided review and independent animated explanations showing the played move, alternative, and legal engine continuation, with pause/step/replay and reduced-motion behavior. Optional speech uses local browser voices.
- Retry practice with hints and solutions. The saved first choice is accepted immediately; other legal moves receive fresh engine comparison and can pass within the documented tolerance while preserving a found mate.
- A personal training list based on actual reviewed errors, with board-derived themes, hints, and links back to each position for review or practice.
- Opening, tactics, strategy, and endgame move-accuracy summaries with sample counts.
- **Saved** history with player search, reopening, per-player/category/time-group statistics, and a recent-versus-earlier comparison when enough dated reviews share the same scoring model.
- Opening names and Book-prefix matching from 3,865 legally validated Lichess lines spanning all 500 ECO codes, plus a separate explorer based on the imported library.
- Play a position against Stockfish, choose a side, undo a turn, and restart the continuation.
- Optional seven-piece standard-chess Syzygy lookup through Lichess, with legal moves, outcome categories, and fifty-move-rule-aware DTZ information.
- Settings for engine budget, arrow mode, classification display, player highlights, time spent, sound, explanation pace/autoplay/detail, coach avatar, skill breakdown, and recommendations.
- Original PGN, annotated PGN, and text-report exports; browser-local libraries, reviews, and settings.

## Public archives and local data

The importer requests Chess.com’s public archive index and every returned monthly archive, newest first. Requests are sequential, with retries, progress, cancellation, and deduplication by game URL. There is no application backend, Chess.com login requirement, or API key.

“All games” means games exposed by the public API’s archive list. Private, deleted, unpublished, or otherwise unavailable games cannot be recovered. Other variants remain in the library with original-PGN export and an explicit unsupported-review message.

A complete saved library loads during the next import while every archive is checked for updates. Partial batches remain usable after a stopped or failed import, but only a completed import replaces the last complete saved library. IndexedDB stores libraries/reviews; localStorage stores settings. Storage failures are shown, and clearing site data removes local records.

Engine analysis runs locally in a Web Worker. Importing sends the username to Chess.com’s public API. Optional tablebase probing sends the selected position’s full FEN to `tablebase.lichess.ovh` only when requested, without credentials; it does not upload a username or game history. Voice playback offers only voices reported as local by the browser.

## Methods and limits

New reviews use accuracy model v2, derived from [Lichess’s published move-accuracy formulas](https://lichess.org/page/accuracy):

```text
Win% = 100 / (1 + exp(-0.00368208 × centipawns))
Move accuracy = clamp(103.1668 × exp(-0.04354 × winning-chance loss) - 3.1669, 0, 100)
```

Loss is measured in percentage points from the mover’s perspective. Forced mates map to 100% or 0%; recorded best moves and only legal moves receive zero loss to reduce search-noise penalties. Game, phase, and category scores average the applicable move scores. This arithmetic mean differs from Lichess’s weighted game score and from Chess.com’s proprietary accuracy. Brilliant/Great, phase boundaries, category definitions, key-moment thresholds, and training themes remain independent heuristics affected by the engine budget.

Older saved reviews retain their original centipawn-based scores. History selects each player’s newest available accuracy model and excludes older models from its statistics and trends; all saved games remain reopenable. Trends require at least four scored, game-dated reviews and a distinct recent/earlier date boundary. Category scores and trends are not calibrated player ratings. Elo or single-game rating prediction is not implemented.

Opening data is pinned to [lichess-org/chess-openings commit `a6189a3`](https://github.com/lichess-org/chess-openings/tree/a6189a30dc273ccb21fc2536a9a2fefd5592a67a), dedicated to the public domain under CC0 1.0. The [local provenance](chess-review/src/data/openings/provenance.json) records source hashes and generation checks. Book means an exact registered move prefix, not proof of move quality; transposed orders must be explicitly present in that dataset. The separate explorer scans imported games, not a global masters database.

Tablebase lookup follows the [Lichess HTTP API](https://github.com/lichess-org/lila-tablebase#http-api), supports standard positions with at most seven pieces and no castling rights, and remains optional. DTZ is not mate distance; cursed wins/blessed losses and uncertain outcomes stay explicit. FEN alone does not supply repetition history. Service availability, CORS, rate limits, and table coverage can affect lookup.

Full Chess.com parity has not been established. Proprietary scoring and Game Rating, coach personalities/media, complete explanation-theme coverage, cloud accounts/synchronization, shared analysis rooms, Chess.com training integration, and every account/experiment branch remain gaps. The [REA feature/evidence ledger](docs/chess-com-review-research.md) separates observed source behavior from the independent implementation.

## Architecture

Paths below are relative to `chess-review/`.

| Module | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/hooks/useWorkspace.ts` | Workspace presentation, selected game/position, mode coordination, and settings. |
| `src/components/` | Board, library, reports, explanations, practice, training, saved history, analysis, tablebase, and dialogs. |
| `src/lib/chesscom.ts`, `game.ts` | Public archive import, PGN/FEN parsing, clocks, and game records. |
| `src/lib/position.ts`, `chess960.ts` | Shared position interface and chessops-backed Chess960 castling, history, and PGN. |
| `src/engine/` | Stockfish worker lifecycle, variant configuration, UCI parsing, and history-aware analysis. |
| `src/lib/review.ts`, `accuracy.ts`, `review-metrics.ts` | Review orchestration, scoring model, classifications, and phases. |
| `src/lib/openings.ts`, `src/data/openings/` | Generated opening trie, pinned source facts, CC0 dedication, and provenance. |
| `src/lib/insights.ts`, `explanation.ts`, `explanation-playback.ts` | Position facts and cancellable explanation playback. |
| `src/lib/practice.ts`, `training.ts`, `history.ts` | Attempt grading, actual-error exercises, and compatible saved-review statistics. |
| `src/lib/explorer.ts`, `play-position.ts`, `tablebase.ts` | Imported-library exploration, engine continuation, and optional tablebase client. |
| `src/lib/report.ts`, `storage.ts`, `settings.ts` | Exports, IndexedDB, and validated preferences. |
| `scripts/copy-engine.mjs`, `update-openings.mjs` | Engine distribution and reproducible opening-data generation. |

The application source and SVG artwork are independently written. Captured Chess.com source/assets and coach media are not copied into the app. Public game PGNs use the public API; the separate open-source engine, Chess960 rules library, and opening-data sources are identified here.

## Stockfish distribution and source

The application pins the npm package [`stockfish@19.0.1`](https://www.npmjs.com/package/stockfish/v/19.0.1) and uses its `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm` files. This is the single-threaded Lite build; it does not require cross-origin isolation headers. It is distinct from the larger full-network Stockfish build.

Stockfish.js is distributed under GPL-3.0. Its bundled license is copied from the package's `Copying.txt` to `public/engine/COPYING.txt` and included in the production build. The upstream project is [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js), based on [Stockfish](https://github.com/official-stockfish/Stockfish).

Version-specific upstream source: [v19.0.1 release](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1), [source tree at commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6), and [source archive](https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz). That commit is the peeled upstream `v19.0.1` tag, verified with `git ls-remote`. The npm package metadata does not publish a `gitHead`; the source commit is therefore identified by the matching upstream release tag, not an npm-reported commit. The exact installed npm artifact is pinned by `package-lock.json` integrity and is available as the [19.0.1 package tarball](https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz).

## Chessops distribution and source

The Chess960 adapter uses [`chessops@0.15.1`](https://github.com/niklasf/chessops), licensed under GPL-3.0-or-later. The unmodified license is included at `chess-review/public/licenses/CHESSOPS-COPYING.txt`; [CHESSOPS-SOURCE.txt](chess-review/public/licenses/CHESSOPS-SOURCE.txt) identifies the upstream source and exact release. The installed artifact is the [0.15.1 npm tarball](https://registry.npmjs.org/chessops/-/chessops-0.15.1.tgz), with its exact package bytes pinned by `package-lock.json` integrity. The license/source files are included in the static production output.
