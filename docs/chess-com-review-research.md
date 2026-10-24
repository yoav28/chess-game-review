# Chess.com Game Review investigation

Investigation date: 24 October 2026. Target: [Chess.com Analysis](https://www.chess.com/analysis). This document records the observed feature surface and the independent implementation requirements; it does not claim exact product parity.

## Evidence and boundaries

The public Analysis page was inspected in the Codex browser. Its shipped scripts were captured through CDP `Page.getResourceContent`, without signing in, into `/tmp/chess-com-rea-capture`. The capture manifest records `2026-10-24T12:15:27.153Z` and deployment `2026.10.3-hotfix.20ef972`.

REA analyzed that captured directory. Retained parent Evidence ID: `ev_be520a14fba478c2ba3b4e2a9e2fcee689a0178b6c0c7c1452858508b3f3d7eb`. REA target root SHA-256: `68e743f59543622d01b4cbdaee927400791a5f6dcc6cf29353e28b75d14ae698`.

Evidence types below distinguish interactive observations from shipped client code. A bundled control, identifier, or translation establishes a client feature surface; it does not establish that the feature is available for every account or that its server behavior was executed. The capture covers six scripts loaded by the public page, not every lazy-loaded bundle or server implementation.

### Recorded browser observations: initial public session

- The welcome flow describes accuracy, brilliant moves, blunders, best continuations, variations, and retrying mistakes.
- An Opera Game PGN was loaded into Analysis. The board, move navigation, and local engine analysis were usable.
- Analysis displayed Stockfish 19 Lite and three candidate lines.
- Opening Game Review required sign-in during this initial session. The original script capture therefore remains a public-session capture.

The welcome descriptions establish advertised functionality. These are interactive investigation notes; the six script captures provide the durable static evidence identified below.

### Recorded browser observations: subsequent signed-in session

The user subsequently signed in voluntarily. The same Opera Game PGN was reviewed at [Chess.com Game Review](https://www.chess.com/analysis/review), and an actual report completed. These later runtime observations supplement the public capture; they do not change its provenance or hashes.

- The report displayed White accuracy 96.1 and Black accuracy 63.3. Its move counts included three White Brilliant moves, one White Great move, and four Black Mistakes. These are observations for this game and engine run, not expected outputs for the independent application.
- The move-quality counts could be expanded and collapsed.
- Start Review opened the move-by-move presentation; Highlights returned to the overview.
- Explain played an animated continuation, and Got it returned to the review. An explanation of Black's `...e5` described occupying the center and freeing development routes.
- A coach audio toggle was present. Actual speech output was not established by observing that control.
- The final report for this unrated imported PGN did not visibly display Game Rating. That feature remains supported by static evidence only for this investigation.
- A later mistake-count selection jumped to `Bxf3`, labeled Mistake, with Explain and Best controls. No Retry control was visible in that account/view; this does not establish absence across accounts or flows. A successful Chess.com retry remains unobserved.

This confirms a signed-in report and the listed interactions. It does not establish all account tiers, coach personalities, move categories, scoring formulas, or review branches.

### Public product documentation

The [official Game Review guide](https://support.chess.com/en/articles/8584089-how-does-game-review-work) was also inspected in the Codex browser. It documents the report, coach/explanation and retry flow. This is product documentation, not evidence that every branch was exercised in the captured session. The independent retry now checks a different legal attempt with fresh engine analysis rather than rejecting it solely because its UCI differs from the saved best move.

The [official Game Rating explanation](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review) gives a qualitative description; it does not publish a recoverable calibration formula. The independent application does not invent a Game Rating.

### Static findings

Offsets are zero-based UTF-8 byte offsets into the identified captured file, useful for reproducing focused searches in minified scripts. They identify evidence anchors rather than complete function ranges.

| Finding | Source anchor | What it establishes |
| --- | --- | --- |
| Move classifications | `tab-review`, byte 18849 | Client constants for Brilliant, Best, Excellent, GreatFind, Tricky, Blunder, Good, Inaccuracy, Mistake, Miss, Book, and Forced. Additional legacy mapping includes MissedWin. It does not reveal their scoring thresholds. |
| Per-player report and phases | `tab-review`, bytes 38580 and 38892 | Opening, middlegame, and endgame grades and phase accuracy values, alongside overall accuracy. |
| Single-game rating | `tab-review`, byte 44953 | Render paths consume `gameRatingV2` or `effectiveElo`, including an insufficient-moves state. The rating formula is not recovered. |
| Skill categories | `tab-review`, byte 33613 | Advanced report categories Opening, Tactics, Strategy, and Endgame, with classifications and rating/change fields. Calculation and complete availability remain unknown. |
| Coach customization | `tab-review`, byte 9294; `analysis.js`, byte 171885 | Coach selection/settings UI and an audio toggle. This does not establish the complete generated explanation, personality, or speech pipeline. |
| Evaluation graph and key moves | `tab-review`, byte 55118; `analysis.js`, byte 86412 | Graph configuration consumes positions/key moves; review navigation maintains per-color key-move indices. |
| Review pages and arrows | `shared.eager`, byte 1691303; `tab-review`, byte 70226 | Overview and move-by-move pages, selected-color changes, best-move controls, arrow modes, and a played/best move setting. |
| Retry and hints | `analysis.js`, bytes 79213 and 206670; `shared.eager`, byte 3157468 | Retry-completed events, hint controls, and best/hint/line actions are wired into the client. A successful authenticated retry was not observed. |
| Continuations and explanation overlays | `shared.eager`, byte 1131016 | Variation show/hide prompts and structures for sentences, arrows, and squares. Explanation quality and complete theme coverage remain unknown. |
| Adjacent Analysis tools | `analysis.js`, bytes 195559 and 195895 | Controls for practice against a computer, saved analysis, sharing, and saving. These extend the surrounding Analysis product beyond the core review report. |

The `tab-analysis` capture also contains Analysis Room session states. Shared analysis rooms are a separate collaboration capability; a room was not created during this investigation.

## Requirements matrix for the independent application

This ledger distinguishes implemented independent behavior from unresolved comparison requirements. [Verification](verification.md) records the actual tests and local browser observations. Similar controls and passing tests do not establish proprietary scoring or complete product parity.

| Feature | Source evidence | Independent implementation and remaining limit |
| --- | --- | --- |
| Username and every available public game | User requirement | Archive traversal, retries, progress, Stop, deduplication, and persistence. A complete browser import returned 67 archives / 9,973 MagnusCarlsen games. Private/deleted/unpublished games remain outside the public API. |
| Game library and selection | User requirement | Search, result/time-control/month filters, pagination, and game selection. Standard and Chess960 review are supported; other variants remain exportable with an unsupported-review message. |
| PGN/FEN and board replay | Public browser | Legal history, clocks, navigation, orientation, coordinates, promotion, check/last-move indicators, and variations. A dedicated rules layer handles Chess960 castling, including king/rook swaps and stationary destinations. |
| Full-game review | Signed-in report and public analysis | Local Stockfish across all positions with progress, cancellation, settings, errors, and saved results. Both imported standard and actual public Chess960 games have completed independent browser reviews. Engine/settings/scoring differ from Chess.com. |
| Overall accuracy | Signed-in report and static report | New model v2 uses [Lichess’s published move formulas](https://lichess.org/page/accuracy), with mover-relative winning-chance loss and arithmetic-mean game/phase scores. It is neither Chess.com CAPS nor Lichess’s weighted game score. Older CPL-model reviews remain identifiable and are excluded from newer-model history cohorts. |
| Move classifications | Signed-in counts and client constants | Brilliant, Great, Book, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Missed opportunity, and Forced use independent rules. Brilliant is a sound-sacrifice heuristic; Great compares two engine candidates; ordinary loss thresholds use winning-chance points. Exact labels/thresholds, Tricky, and legacy MissedWin remain unresolved. |
| Opening names and Book | Client book identifiers | 3,865 legally replayed, CC0 [Lichess opening lines](https://github.com/lichess-org/chess-openings/tree/a6189a30dc273ccb21fc2536a9a2fefd5592a67a), all 500 ECO codes, with pinned hashes/provenance. Book means exact registered prefix; transpositions require an explicit line. No claim of the Chess.com book is made. |
| Evaluation graph and candidate lines | Public analysis and static graph | Evaluation/mate display, clickable graph, best-move arrow, three legal engine lines, variations, and restoration to the game. White-relative scores stay distinct from side-relative tablebase results. |
| Guided overview / Explain | Signed-in Start Review, Highlights, Explain, Got it | Guided controls and original animated explanation steps: before/played/alternative/continuation, captions, arrows, pause/step/replay, return, adjustable pace, and reduced-motion handling. Broader teaching-theme coverage and exact Chess.com explanation parity remain gaps. |
| Coach and speech | Signed-in explanation; static coach/audio controls | Board facts and engine choices in concise/detailed modes, optional avatar, optional local OS speech. No proprietary coach media or personality/backend is copied; Chess.com audio was not established by the source-session control alone. |
| Key moments / player focus | Static key-move navigation | Winning-chance-loss ranking for new reviews, legacy CPL fallback, both-player focus and username/opponent highlight choices. Ranking is independent. |
| Retry and hints | Welcome, official guide, static retry controls; source successful retry unobserved | Restores the actual pre-error position, offers hint/solution, and advances through selected-player errors. Saved best is accepted directly; another legal move is assessed before/after with matching budgets and complete PGN history, a 30-centipawn tolerance, and mate preservation. Feedback reports SAN, evaluations, first choice, budget, and achieved depth. Cancellation discards stale results. A distinct alternative mate passed local browser verification in an explicitly synthetic study. |
| Phase and skill reports | Static phase/category report | Independent phase boundaries and Opening/Tactics/Strategy/Endgame eligible-move accuracy, with move counts. Tactics covers captures/checks/promotions; Strategy covers quiet middlegame moves; overlap and unavailable categories remain explicit. No calibrated skill ratings are claimed. |
| Historical statistics | Static advanced rating/change fields | Saved-browser player statistics, category and time-group samples, separate Chess960 groups, and dated recent/earlier comparisons within one scoring model. At least four scored games and a distinct date boundary are required. These are local move statistics, not Chess.com account history or skill ratings. |
| Estimated Game Rating | Static fields and official qualitative guide | Explicit unresolved gap. No calibrated independent estimator or recovered proprietary formula exists; no fabricated Elo is shown. |
| Board/review settings | Static arrows, overlays, and settings | Engine depth/time, best/coach/both/no arrows, classification highlights, username/opponent selection, time spent when clock data allows, sound, coach detail/avatar, explanation autoplay/pace, recommendations, and skill visibility. Exact coach selection/personality parity remains unresolved. |
| Save / reopen / export | Surrounding Analysis save/share controls | IndexedDB libraries and reviews; discoverable Saved history; original and annotated PGN and text reports. Chess960 variant/FEN/castling survive exports. Cloud sync/accounts and Chess.com social sharing remain gaps. |
| Play against computer | Surrounding Analysis control | Continue from a position with full history, select side, legal engine reply, undo a user/reply turn, restart, and cancel. Local browser and bundled-engine tests cover the implemented flow. |
| Opening explorer | Surrounding Analysis identifiers | Scans the imported library by position/variant, including transpositions, frequencies/results/average recorded ratings. This is a local-library explorer, not Chess.com’s global masters database. |
| Endgame tablebases | Adjacent Analysis identifiers | Optional [Lichess Syzygy HTTP API](https://github.com/lichess-org/lila-tablebase#http-api) probe for standard positions with ≤7 pieces and no castling rights, including legal moves, side-correct outcomes, and explicit DTZ50″/fifty-move caveats. Actual CORS lookup and playing a returned promotion were verified locally. FEN does not convey repetition history; this is not a recovered Chess.com service. |
| Recommended training | Adjacent Analysis identifiers | Original drills reference actual review plies, ranked by winning-chance loss (legacy CPL fallback), with factual loose-piece/fork/pin/mate/development/castling themes and practice/review actions. No copied lesson catalog, fictitious links, calibrated user ratings, or Chess.com course integration. |
| Shared Analysis Rooms | Shipped session states | Unimplemented. No room was created or server workflow recovered. |

## Captured script identities

Each source URL below is copied from the capture manifest. SHA-256 values were computed from the captured local bytes. The deployment suffix is a version clue; the hashes establish the actual inspected content identity.

| Local filename / source URL | SHA-256 |
| --- | --- |
| [shared.eager.DKz_V58PP2.chunk.js](https://www.chess.com/r2/client-packages/analysis/2026.10.3-hotfix.20ef972/shared.eager.DKz_V58PP2.chunk.js) | `55e2e979c29909d0a58695055c5932deb39d0d8e447268e84b3166d3b8b03930` |
| [tab-analysis.3e85b73f.XUtQDAGH37.chunk.js](https://www.chess.com/r2/client-packages/analysis/2026.10.3-hotfix.20ef972/tab-analysis.3e85b73f.XUtQDAGH37.chunk.js) | `53ca836e683b00eec95f45c36a17a1e9628e5137aa18150e7f284ce1aa08c642` |
| [components.e4d3e7bb.CoiPdL94f1.chunk.js](https://www.chess.com/r2/client-packages/analysis/2026.10.3-hotfix.20ef972/components.e4d3e7bb.CoiPdL94f1.chunk.js) | `5649899d625cd65f506376ac33eca5d76bc641f858071a879ebfc7e734b4c4a4` |
| [analysis.e3ec5995.UwOvw-BX_V.chunk.js](https://www.chess.com/r2/client-packages/analysis/2026.10.3-hotfix.20ef972/analysis.e3ec5995.UwOvw-BX_V.chunk.js) | `bc602542de57ec78518dcabff3fad5a267435d89de2af4a9f15ad4fe8c13ba3d` |
| [analysis.js](https://www.chess.com/r2/client-packages/analysis/2026.10.3-hotfix.20ef972/analysis.js) | `39c197549d5b778195237ea35127736154e2472d95ffec6c3f0aa35e0c4e6e46` |
| [tab-review.88a71be6.BWieoMcwwK.chunk.js](https://www.chess.com/r2/client-packages/analysis/2026.10.3-hotfix.20ef972/tab-review.88a71be6.BWieoMcwwK.chunk.js) | `c414443c71229a54c231c38f68cacc0e547a56a28f926c1ca0f197e0f5acfd33` |

## Reconstruction boundary

The application uses independently written source, original SVG piece artwork, its own interface, chess.js standard legality, the chessops-backed Chess960 adapter, and the separately distributed Stockfish engine. The chessops GPL-3.0-or-later license and source information are included with the static application. Captured Chess.com scripts, proprietary assets, coach media, source excerpts, and the capture directory must not be committed into the application repository. The investigation informs a feature specification; it does not supply implementation code.

The signed-in Opera Game report and listed interactions are runtime-observed. Proprietary scoring formulas, a successful Chess.com retry, Game Rating in an applicable source report, every account/locale/experiment branch, and complete server behavior remain unresolved. Independent import, standard/Chess960 review, practice, and tablebase checks prove only the recorded implementation flows. They do not establish every feature or server branch in the source product. The latest additions remain local and have not replaced the earlier private deployment.
