# Open File

An independent chess review application built with React, TypeScript, Vite, chess.js, Chess960/three-check rules using chessops, local Stockfish 19 Lite, and Fairy-Stockfish. Choose a Chess.com username, import every available public archive, and review standard, material-odds, Chess960, or three-check games in your browser. An Opera Game sample is included.

The latest work is local. The [previous private deployment](https://open-file-chess-review.woolly-rice-1868.chatgpt.site) is an older release and has not been updated with the features below. No current changes have been pushed or redeployed. See [verification.md](docs/verification.md) for recorded checks and their limits.

## Run locally

Use Node.js 22.12 or newer, or Node.js 20.19 or newer in the 20.x release line, with npm.

```sh
cd chess-review
npm ci
npm run dev
```

Open the local URL printed by Vite. The dev script prepares the engine JavaScript, WebAssembly, licenses, and source information in `public/engine/`.

Three-check and multi-thread position analysis need `SharedArrayBuffer` and cross-origin isolation. Vite development and preview set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. A production static host must serve those response headers too, over HTTPS or loopback. The single-thread Stockfish 19 Lite build does not need them. Three-check reports an explicit engine error when isolation is missing; position analysis offers threads up to the limit reported by the browser.

```sh
npm test
npm run build
npm run preview
```

Tests cover public archive import, cancellation and stale requests, standard, Chess960, and three-check legality, single- and multi-thread engine searches, bounded and continuous analysis, scoring, explanations, practice, training, historical model separation and duplicate suppression, portable-report validation, masters/tablebase responses, opening-data integrity, and exports. `build` typechecks the app, copies engine assets, and produces `chess-review/dist/`. `preview` serves that production build locally.

## Use the application

Enter a Chess.com username in the library and choose **Import all games**. Search or filter by player, time control, result, or month. Select a game and start its review. Add a multi-game PGN export to include games outside public archives, or load one PGN game or a FEN position.

The application provides:

- Full-game Stockfish review with progress, cancellation, adjustable depth/time/thread count, per-player accuracy, classifications, key moments, and opening/middlegame/endgame reports. Reports record the engine profile; a different thread count can produce different search results.
- Position analysis streams scored lines using one to eight available threads. Choose 3–30 seconds or Unlimited, stop to retain the latest scored lines, or start a fresh search. Changing the position, variant, or search settings cancels the previous worker. Full-game reviews, practice, and engine play retain their own budgets.
- Standard chess, material-odds games with their recorded custom starts, Chess960, and three-check replay, review, variations, engine continuation, and reviewed PGN export. Three-check tracks checks given and ends immediately on the third check. Chess960 uses king-to-rook engine UCI for castling while showing the physical king/rook destinations correctly.
- Four original board palettes (Sage, Walnut, Graphite, High contrast), three original piece sets (Classic, Geometric, Letters), and optional coordinates. Preferences persist locally and apply to the live board, promotion choices, PNG reports, animated GIFs, and offline HTML/iframe replays or puzzles. Appearance controls are available in Settings and the embed exporter.
- Board clocks, estimated time spent where sufficient PGN clock/control data exists, promotion choices, orientation and keyboard controls, right-click arrows/circles, and classification highlights.
- Evaluation bar/graph, one to five configurable candidate lines, playable variations, and return to the recorded game.
- Guided review and independent animated explanations showing the played move, alternative, and legal engine continuation, with pause/step/replay and reduced-motion behavior. Clear, Supportive, and Analyst presentation profiles change the original explanation/narration style; Analyst includes recorded search details. Optional speech uses local browser voices.
- Retry practice with hints and solutions. The saved first choice is accepted immediately; other legal moves receive fresh engine comparison and can pass within the documented tolerance while preserving a found mate.
- A personal training list based on actual reviewed errors, with board-derived themes, hints, and links back to each position for review or practice.
- A factual overview of the recorded result, error counts, largest loss, and replayable opening/last-book position, with a link from the opening summary to the local position explorer. When a Chess.com library is loaded, it also shows the selected player’s local win/draw/loss record for games sharing that ECO code; the count groups named variations.
- **Saved** history with player search, reopening, per-player/category/time-group statistics, and a recent-versus-earlier comparison when enough dated reviews share the same scoring model.
- Opening names and Book-prefix matching from 3,865 legally validated Lichess lines spanning all 500 ECO codes, plus a position explorer based on the imported library. An optional online Lichess masters panel is integrated, but anonymous live requests returned HTTP 401 in this environment; a successful masters fetch remains unverified.
- Play a position against Stockfish, choose a side, undo a turn, and restart the continuation.
- Optional seven-piece standard-chess Syzygy lookup through Lichess, with legal moves, outcome categories, and fifty-move-rule-aware DTZ information.
- Settings for engine budget, one to five analysis lines, arrow mode, classification display, player highlights, time spent, sound, explanation pace/autoplay/detail/profile, coach avatar, skill breakdown, and recommendations.
- Original PGN, annotated PGN, and text-report exports, plus complete-review JSON download/import that preserves the existing scores and engine lines without reanalysis. Imported reports remain labeled as file-provided. Libraries, reports, the selected username, and settings are browser-local and restore when the app is reopened.
- PNG reports with original board artwork, scores, graph, classifications, and provenance; complete-game animated GIFs with progress/cancellation; and offline HTML or sandboxed iframe replays with navigation, autoplay, orientation, coordinates, and recorded explanations. Puzzle mode lets recipients guess the recorded moves from the beginning or a selected position, with automatic opponent replies, hints, retries, solution reveal, reset, promotion choices, and keyboard controls.
- Optional opponent-threat analysis runs a separate hypothetical opponent-to-move search, shows a red arrow, and keeps the actual position unchanged. Checks and terminal positions disable it; changing position clears the result.

## Public archives and local data

The importer requests Chess.com’s public archive index and every returned monthly archive, newest first. Requests are sequential, with retries, progress, cancellation, and deduplication by game URL. Multi-game PGN files are stored separately in the browser and merged into the selected username’s library. There is no application backend, Chess.com login requirement, or API key.

“All games” means games exposed by the public API’s archive list. Private, deleted, unpublished, or otherwise unavailable games cannot be recovered. Other variants remain in the library with original-PGN export and an explicit unsupported-review message.

The selected username, saved games, and last selected library game restore when the app reopens; saved reviews reopen with that game. Choosing **Import all games** checks every archive for updates; partial batches remain usable after a stopped or failed import, and the library marks the archive import incomplete until a later run finishes. IndexedDB stores libraries and reviews; localStorage stores the selected username, game selection, settings, and compact import status. Storage failures are shown, and clearing site data removes local records.

Engine analysis runs locally in a Web Worker. Importing sends the username to Chess.com’s public API. Optional tablebase probing sends the selected position’s full FEN to `tablebase.lichess.ovh` only when requested, without credentials; it does not upload a username or game history. The optional masters panel sends the selected standard-chess FEN to `explorer.lichess.org` only after **Load masters**, also without credentials. Voice playback offers only voices reported as local by the browser.

## Methods and limits

New reviews use accuracy model v2, derived from [Lichess’s published move-accuracy formulas](https://lichess.org/page/accuracy):

```text
Win% = 100 / (1 + exp(-0.00368208 × centipawns))
Move accuracy = clamp(103.1668 × exp(-0.04354 × winning-chance loss) - 3.1669, 0, 100)
```

Loss is measured in percentage points from the mover’s perspective. Forced mates map to 100% or 0%; recorded best moves and only legal moves receive zero loss to reduce search-noise penalties. Game, phase, and category scores average the applicable move scores. This arithmetic mean differs from Lichess’s weighted game score and from Chess.com’s proprietary accuracy. Brilliant/Great, phase boundaries, category definitions, key-moment thresholds, and training themes remain independent heuristics affected by the engine budget.

Three-check uses Fairy-Stockfish classical scores with the same bounded move-quality transformation as a heuristic. These scores are not calibrated winning probabilities, player ratings, or proprietary Chess.com scores. Forced variant wins are labeled as wins rather than checkmates. Standard opening-book, online masters, and standard Syzygy services do not apply to three-check.

Older saved reviews retain their original centipawn-based scores. History counts an exact PGN/variant once for statistics, preferring the newer model, then a local-generated report, then the latest analysis. Statistics select one rules pool before selecting each player’s newest available accuracy model and reports older-model and duplicate exclusions separately; all saved copies remain reopenable. Trends require at least four scored, game-dated reviews and a distinct recent/earlier date boundary. Category scores and trends are not calibrated player ratings. Elo or single-game rating prediction is not implemented.

Opening data is pinned to [lichess-org/chess-openings commit `a6189a3`](https://github.com/lichess-org/chess-openings/tree/a6189a30dc273ccb21fc2536a9a2fefd5592a67a), dedicated to the public domain under CC0 1.0. The [local provenance](chess-review/src/data/openings/provenance.json) records source hashes and generation checks. Book means an exact registered move prefix, not proof of move quality; transposed orders must be explicitly present in that dataset. The local explorer scans imported games. The separate optional masters client follows the [official Lichess API schema](https://github.com/lichess-org/api) and [opening-explorer service documentation](https://github.com/lichess-org/lila-openingexplorer). It validates returned moves/counts/example-game metadata and has cancellation, bounded caching, and actionable service errors. Both inspected live explorer hosts denied anonymous access with HTTP 401, so successful online data retrieval is not claimed.

Tablebase lookup follows the [Lichess HTTP API](https://github.com/lichess-org/lila-tablebase#http-api), supports standard positions with at most seven pieces and no castling rights, and remains optional. DTZ is not mate distance; cursed wins/blessed losses and uncertain outcomes stay explicit. FEN alone does not supply repetition history. Service availability, CORS, rate limits, and table coverage can affect lookup.

Complete-review files use a versioned Open File JSON envelope and validate PGN/history, legal standard/Chess960/three-check best/PV moves, metadata, numeric bounds, and summary consistency. Files are limited to 12 MB, 2,000 game plies, and 20,000 recorded continuation moves; importing does not authenticate the author or engine scores, and the imported-report notice survives saving/reopening. The app does not upload these files or create a public hosted share link.

Full Chess.com parity has not been established. Proprietary scoring and Game Rating, coach personalities/media, complete explanation-theme coverage, cloud accounts/synchronization, shared analysis rooms, alternate proprietary engines and premium strengths, Chess.com training integration, and every account/experiment branch remain gaps. Position analysis and full-game reviews include bounded searches and local thread controls; position analysis also supports Unlimited search. Full-game reviews remain time-limited. The [empirical rating pilot](docs/rating-pilot.md) analyzed 230 games but failed its release gates (held-out error 349.48 rating points); it remains research, with no user-facing rating estimate. The [REA feature/evidence ledger](docs/chess-com-review-research.md) separates observed source behavior from the independent implementation.

A separate [stratified rating study](docs/rating-validation-v2.md) reviewed 800 September games. Its 495.80-point held-out error and ±906.35-point empirical interval failed the unchanged release gates; no rating estimate is enabled. Offline embeds do not reproduce Chess.com forum codes, cloud diagram storage, or selectable proprietary piece sets. Offline recorded-move puzzles provide the corresponding interactive practice flow; alternate good moves are not accepted as the recorded move.

The imported MagnusCarlsen library contains 9,648 standard games, 317 Chess960 games, six material-odds games, and two three-check games. All four groups now have appropriate rules and engine support. Both actual three-check PGNs completed browser review, and their original counters, positions, clocks, and results survived reviewed exports. This verifies the imported sample, not every possible variant or malformed PGN.

## Architecture

Paths below are relative to `chess-review/`.

| Module | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/hooks/useWorkspace.ts` | Workspace presentation, selected game/position, mode coordination, and settings. |
| `src/components/` | Board, library, reports, explanations, practice, training, saved history, analysis, tablebase, and dialogs. |
| `src/lib/chesscom.ts`, `game.ts` | Public archive import, PGN/FEN parsing, clocks, and game records. |
| `src/lib/position.ts`, `chessops-board.ts`, `variants.ts`, `variant-pgn.ts` | Shared rules interface, Chess960 castling, three-check counters/outcomes, history, and variant PGN. |
| `src/engine/` | Stockfish worker lifecycle, variant configuration, UCI parsing, and history-aware analysis. |
| `src/lib/review.ts`, `accuracy.ts`, `review-metrics.ts` | Review orchestration, scoring model, classifications, and phases. |
| `src/lib/openings.ts`, `src/data/openings/` | Generated opening trie, pinned source facts, CC0 dedication, and provenance. |
| `src/lib/insights.ts`, `explanation.ts`, `explanation-playback.ts` | Position facts and cancellable explanation playback. |
| `src/lib/practice.ts`, `training.ts`, `history.ts` | Attempt grading, actual-error exercises, and compatible saved-review statistics. |
| `src/lib/explorer.ts`, `master-explorer.ts`, `play-position.ts`, `tablebase.ts` | Local-library/optional online exploration, engine continuation, and optional tablebase client. |
| `src/lib/report.ts`, `review-transfer.ts`, `review-transfer-validation.ts`, `storage.ts`, `settings.ts` | Text/PGN and validated complete-report transfer, IndexedDB, and preferences. |
| `scripts/copy-engine.mjs`, `update-openings.mjs` | Engine distribution and reproducible opening-data generation. |

The application source and SVG artwork are independently written. Captured Chess.com source/assets and coach media are not copied into the app. Public game PGNs use the public API; the separate open-source engine, Chess960 rules library, and opening-data sources are identified here.

## Stockfish distribution and source

The application pins the npm package [`stockfish@19.0.1`](https://www.npmjs.com/package/stockfish/v/19.0.1). Full-game reviews and one-thread position analysis use `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm`. Both position analysis and full-game review can select up to eight browser-reported threads using `stockfish-19-lite.js` and `stockfish-19-lite.wasm` when cross-origin isolation is enabled. Both builds stay local and are distinct from the larger full-network Stockfish build.

Stockfish.js is distributed under GPL-3.0. Its bundled license is copied from the package's `Copying.txt` to `public/engine/COPYING.txt` and included in the production build. The upstream project is [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js), based on [Stockfish](https://github.com/official-stockfish/Stockfish).

Version-specific upstream source: [v19.0.1 release](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1), [source tree at commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6), and [source archive](https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz). That commit is the peeled upstream `v19.0.1` tag, verified with `git ls-remote`. The npm package metadata does not publish a `gitHead`; the source commit is therefore identified by the matching upstream release tag, not an npm-reported commit. The exact installed npm artifact is pinned by `package-lock.json` integrity and is available as the [19.0.1 package tarball](https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz).

The multithreaded Lite JavaScript and WebAssembly files are also copied unmodified from that pinned package, with the same GPL-3.0 license and upstream release. The app selects them for position analysis only when the browser supports cross-origin isolation and the saved thread count fits the available hardware.

## Chessops distribution and source

The Chess960 and three-check adapters use [`chessops@0.15.1`](https://github.com/niklasf/chessops), licensed under GPL-3.0-or-later. The unmodified license is included at `chess-review/public/licenses/CHESSOPS-COPYING.txt`; [CHESSOPS-SOURCE.txt](chess-review/public/licenses/CHESSOPS-SOURCE.txt) identifies the upstream source and exact release. The installed artifact is the [0.15.1 npm tarball](https://registry.npmjs.org/chessops/-/chessops-0.15.1.tgz), with its exact package bytes pinned by `package-lock.json` integrity. The license/source files are included in the static production output.

GIF encoding uses [`gifenc@1.0.3`](https://github.com/mattdesl/gifenc), pinned in `package-lock.json`. Its MIT license and source information are included in `chess-review/public/licenses/GIFENC-LICENSE.txt` and `GIFENC-SOURCE.txt`. The encoder and SVG serialization runtime load when exporting; game analysis does not require them.

## Fairy-Stockfish distribution and source

Three-check pins [`fairy-stockfish-nnue.wasm@1.1.12`](https://www.npmjs.com/package/fairy-stockfish-nnue.wasm/v/1.1.12), with `UCI_Variant=3check`, Hash 32, and `Use NNUE=false`. Position analysis and full-game reviews set the chosen browser-supported thread count. It uses classical evaluation; no separate NNUE weights are supplied or fetched. The npm `gitHead` and upstream `1.1.12` tag both identify [commit `b2e693ef1e111233ce3fb40685921708b3276ed6`](https://github.com/fairy-stockfish/fairy-stockfish.wasm/tree/b2e693ef1e111233ce3fb40685921708b3276ed6). GPL-3.0, AUTHORS, exact-package information, and the corresponding source archive are included under `public/engine/fairy/`. The unmodified engine files are separate from the application’s browser bridge.
