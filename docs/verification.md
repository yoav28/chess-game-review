# Verification — 24 October 2026

Open File is an independent reconstruction informed by REA, a signed-in Chess.com comparison, official product documentation, and public game data. The evidence below verifies specific implementation flows; it does not prove complete Chess.com parity.

## Current local checks

- The latest full `npm test` run in `chess-review/` passed **223 tests with zero failures**, including the current transfer, presentation, masters-client, and rating-pilot tests. Coverage includes real bundled Stockfish analysis; standard/Chess960 legality, castling, review, and exports; opening-data integrity; v2 scoring regressions; explanation playback; alternative-attempt grading and stale-result cancellation; compatible historical cohorts; archive import; and tablebase validation, errors, timeout, cancellation, and caching.
- The final `npm run build` passed TypeScript and Vite. Main JavaScript is 473.46 kB (151.08 kB gzip), the opening-data chunk is 465.31 kB (81.24 kB gzip), and CSS is 42.90 kB (9.14 kB gzip). Engine JavaScript/WebAssembly, licenses, and source information are included in the output.
- Opening-data tests legally replay all **3,865 lines**, verify **all 500 ECO codes**, and compare generated runtime matching with the pinned source. The [provenance manifest](../chess-review/src/data/openings/provenance.json) records source URLs, SHA-256 digests, CC0 licensing, and generation counts.
- An additional live public-game check replayed **six Chess960 games totaling 393 plies**, with engine and export verification. This supplements the committed unit/engine fixtures; it does not establish support for every malformed PGN or every variant.

## Current Codex browser checks

These checks used the local app. Hosted execution of the new version has not been tested because it has not been deployed.

| Flow | Observed result |
| --- | --- |
| Complete username refresh | Importing MagnusCarlsen restored the cached library, then completed all 67 / 67 returned archive requests and displayed “All 9,973 public games imported.” |
| Actual public Chess960 review | MagnusCarlsen vs Fh2411, [public game 186477389371](https://www.chess.com/game/live/186477389371): 57 plies / 58 analyzed positions completed at depth limit 16 and 0.5 seconds per position. The new independent v2 accuracies were 87.8 / 83.5. These are budget/device-dependent results, not Chess.com comparison targets. |
| Winning-position scoring regression | Final `29.Rxc7+` was Good, not a missed opportunity, and was absent from the key-moment and top-three training lists. This verifies the v2 correction for a lost mate announcement that still leaves a substantial winning evaluation; the old CPL-based score exaggerated the loss. |
| Distinct alternative in retry practice | An explicitly synthetic verification study used `7k/R7/5KQ1/8/8/8/8/8 w - - 0 1`, with recorded `Ra6` causing stalemate and saved engine choice `Rh7#`. Starting from **Practice position**, playing the different legal `Qg7#` passed fresh comparison with zero loss and mate preservation; reported depths were 16 / 0 because the resulting position was terminal. This verifies alternative-move acceptance, not just exact saved-UCI matching. |
| Portable complete-review JSON | A legacy Opera Game report downloaded and imported in the Codex browser retained 98.7 / 73.6 scores and all 33 plies. The imported-report provenance notice was visible, and no engine reanalysis ran. This proves file transfer of the existing report, not authenticity or fresh scoring. |
| Actual Chess960 complete-review transfer | The 57-ply MagnusCarlsen–Fh2411 JSON report round-tripped with its 87.8 / 83.5 scores. Replaying its castling position after import showed the king on g1 and rook on f1. |
| Rejected malformed transfer | A file with a mismatched illegal `a1a8` move was rejected, and the current selected game stayed unchanged. |
| Saved statistics after import | MagnusCarlsen’s statistics remained 87.8 over 29 moves / one game, with one duplicate report excluded separately from one older-model report. Importing a copy did not inflate the sample. |
| Five analysis lines | Selecting five analysis lines produced five actual legal Stockfish principal variations in the live browser. |
| Presentation and settings persistence | Analyst presentation persisted in settings; the actual explanation included recorded search depth 16 and the legacy centipawn-loss detail. These are original presentation choices, not a copied Chess.com personality. |
| Factual overview / opening replay | The overview showed recorded result/error count and last-book replay. Selecting `2...d6` navigated to ply 4 and showed the pawn on d6. |
| Online masters integration: error path only | The client schema and example response shape were checked against official Lichess sources. Actual requests to the inspected `.org` and `.ovh` explorer hosts both returned nginx HTTP 401. The integrated local app displayed an actionable anonymous-access denial. No successful live master-game statistics or continuations were verified. |
| Refreshed Chess960/v2 PGN export | The newly downloaded `MagnusCarlsen-Fh2411-review (1).pgn` reparsed and matched all 58 positions, 57 plies, 57 clock entries, and the original 1-0 result. It retained the v2 method metadata and the final `Rxc7+` Good annotation. |
| About dialog | Browser inspection showed the current v2 scoring explanation and standard/Chess960 support accurately. |
| Optional tablebase and real network/CORS | `4k3/6KP/8/8/8/8/7p/8 w - - 0 1` returned Win, DTZ 1, and nine legal moves from Lichess. Selecting `h8=Q+` showed a queen on h8, Black’s king on e8 in check, and a legal variation. No errors were observed. |

Targeted automated checks additionally cover complete-report validation, retained imported provenance, exact PGN/variant duplicate suppression in historical statistics, configurable explanation autoplay/pace, reduced-motion behavior, solution playback, training references, settings normalization/migration, compatible history trends, castling edge cases, and stale asynchronous responses. A passing pure-state test is not a claim that every corresponding visual/account/browser configuration has been exercised.

## Earlier local browser evidence

The following observations came from the preceding implementation and remain useful evidence of the import and core analysis flow. Their legacy accuracy values and earlier variant/explorer coverage are not results for the current scoring model.

| Flow | Earlier observed result |
| --- | --- |
| Saved-history cohort, before duplicate suppression | The earlier v2 browser run showed MagnusCarlsen at 87.8 over 29 moves / one game, an older-model exclusion, category samples, and Blitz · Chess960. Later exact-PGN/variant duplicate suppression reports duplicate copies separately; all saved rows remain reopenable. |
| Complete username import | All 67 returned MagnusCarlsen monthly archives completed; 9,973 public games were available. “All” is limited to the public archive index. |
| Saved library/review | Reimport restored saved games during refresh; a completed imported-game review reopened from IndexedDB. |
| Imported standard-game review | Toxicmybrother vs MagnusCarlsen, 77 plies / 78 positions, completed at depth limit 16 / 0.5 seconds. Legacy model accuracies were 96.1 / 94.3; they must not be pooled with v2 scores. |
| Practice | The move-16 position before Rxe7 offered a d1 hint and Qf3 solution. Qf3 passed; a3 produced retry feedback. Current alternative-move handling has additional evidence above. |
| Analysis and engine play | Three legal scored lines appeared; e4 entered a variation and Return restored the game. Starting after e4 as Black accepted e5, Stockfish replied Nf3, and Undo removed the user/reply pair. |
| Library explorer | All 9,973 records were scanned; the then-standard-only explorer reported 9,648 valid games and 325 skipped variants/invalid records. This earlier count does not describe current Chess960 coverage. |
| Modal/mobile | Settings opened and Escape closed it while review continued. At 390 × 844, no horizontal overflow was observed; board, mobile library drawer, and PGN dialog were usable. |
| Underpromotion | `7k/P7/8/8/8/8/8/7K w - - 0 1` exposed all four promotion choices; choosing a knight produced `a8=N`. |
| Reviewed PGN download | The browser’s downloaded standard-game PGN reparsed with all 77 plies, result 1-0, 78 annotated positions, and clock annotations. Current tests add Chess960 castling/variant export coverage. |

## Source comparison and unresolved scope

The [REA investigation](chess-com-review-research.md) retains the captured-script hashes, source anchors, authenticated Opera Game report, and official Chess.com documentation links. Chess.com’s proprietary scoring, calibrated Game Rating, a successful source-product retry, every coach/theme/account/experiment branch, cloud synchronization, and shared Analysis Rooms remain unresolved or unimplemented. Further source-desktop inspection observed the engine/strength/time/thread/interface controls listed in the investigation. Submitting the second rated 77-ply game reached the account’s Daily limit reached popup, so no applicable second report or Game Rating was obtained. Independent local training, history, file sharing, presentation profiles, and Lichess clients do not establish equivalent Chess.com services. The masters service’s live denial remains an explicit verification limit.

The [Lichess move-accuracy formulas](https://lichess.org/page/accuracy) inform v2. Open File uses arithmetic means for whole-game/phase/category scores, unlike Lichess’s weighted whole-game score. Legacy reviews retain their own method, and history never pools their move scores with v2. No user Elo or Game Rating is fabricated. The empirical rating pilot is separate research, with its measured limitations below.

## Empirical rating pilot: release gates failed

The separate [rating-pilot report](rating-pilot.md) and [compact numerical artifact](../chess-review/src/data/rating-pilot-v1.json) record 337 eligible player-game observations from 230 public rated standard blitz games. The fixed profile was Stockfish 19 Lite, depth limit 10, 30 ms per position, two lines, and v2 features. Player-separated filtering retained 135 training observations from 95 players, 47 calibration observations from 33 players, and 67 held-out observations from 42 players.

Held-out mean absolute error was **349.48 rating points**, compared with **370.21** for the training-median baseline, an improvement of about **5.6%**. The nominal 90% interval had radius **±615.33 points** and observed coverage **86.57%**. Training ratings covered only **100–1460**; stronger-player and other time-control/profile coverage remains insufficient.

Six predeclared acceptance gates failed, including sample size, baseline improvement, absolute error, interval width, and rating-band coverage. The estimator therefore remains unavailable in the app. Its target was recorded player blitz rating, not ground-truth performance in one game and not Chess.com Game Rating. No user rating is inferred from these findings. Root-level offline replay returned `verified: true` and `available: false`, reproduced all six reasons, and verified the recorded data/code hashes. The retained artifact supports offline replay; repeated-player dependence and sampling bias prevent a population guarantee.

## Previous private deployment and current local-only work

The [private deployment](https://open-file-chess-review.woolly-rice-1868.chatgpt.site) remains the earlier release built from Site-source commit `7f33529f2e54c320050a6ccdcad1356b143ccb64`, with 77 passing tests at that time. It does not contain the current Chess960, expanded openings, explanation/training/history/settings, portable sharing, presentation profiles, masters client, tablebase, or v2 updates.

Opening that deployment reached its ChatGPT sign-in gate; hosted engine execution was not verified beyond the gate. Current browser engine checks above were local. This iteration remains in the local Git repository, with no push or redeployment, following the user’s instruction. No app access was made public.
