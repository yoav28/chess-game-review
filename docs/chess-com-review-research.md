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
- A successful retry attempt has not yet been observed in the Chess.com session.

This confirms a signed-in report and the listed interactions. It does not establish all account tiers, coach personalities, move categories, scoring formulas, or review branches.

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

This matrix is a specification and gap ledger, not a declaration that each row has passed verification. Core rows require working user flows and runtime validation. Approximations must be visible in the product and documentation.

| Feature | Evidence | Independent implementation requirement or explicit gap |
| --- | --- | --- |
| Pick a Chess.com username and import every available game | User requirement; independent browser verification | Implemented archive traversal, progress, cancellation, deduplication, persistence, and errors. A full `magnuscarlsen` import completed with 9,973 games in the browser. This means games exposed by the public API; private/deleted/unpublished games cannot be promised. |
| Browse and select imported games | User requirement | The library includes search/filtering and opponent, result, time-control, and date information. Completion of an imported game's review still needs browser verification after the current application changes. Unsupported variants are identified instead of analyzed as standard chess. |
| PGN and board replay | Browser-observed | Import PGN; preserve legal game history; support previous/next/start/end navigation, orientation, coordinates, last move, and check indicators. |
| Full-game engine review | Signed-in report; browser analysis; static report | Implemented local Stockfish review across all positions, progress, cancellation, settings, errors, and saved results. A sample-game review completed in the independent application's browser. Review of a freshly imported game remains pending verification. Engine settings and scoring differ from Chess.com. |
| Overall accuracy | Signed-in report and static report | Per-player accuracy uses a documented independent metric: mean move score, where move score is `100 × exp(−centipawn loss / 250)`. These values are not Chess.com CAPS or an exact reproduction of the observed 96.1/63.3 report. |
| Move classifications and counts | Signed-in counts and static constants | Implemented Brilliant, Great, Book, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Missed opportunity, and Forced. Brilliant uses a sound-sacrifice heuristic; Great compares the best two candidates; Book matches a small local registry. These are independent, depth-dependent rules. Tricky, legacy MissedWin, and exact Chess.com classification parity remain gaps. |
| Evaluation bar and interactive graph | Static graph plus browser analysis | Show evaluation/mate values and a graph that navigates to the corresponding move. Keep evaluation perspective consistent. |
| Best moves and candidate lines | Browser-observed and static controls | Offer a best-move arrow, SAN continuations, multiple engine lines, playable variations, and restoration to the original game. |
| Guided review and overview navigation | Signed-in Start Review / Highlights interaction | The independent application includes guided previous/next/finish controls. Chess.com's animated Explain / Got it flow was observed; an equivalent independently generated animated explanation sequence is not yet verified. |
| Move explanations / coach | Signed-in explanation; static coach/overlay structures | Implemented independent engine/fact-based explanations and optional reading through local English OS voices. Speech controls require an available local voice; no proprietary coach media or remote speech is used. Chess.com coach personalities, teaching-theme coverage, and exact explanation/audio parity remain gaps. |
| Key moments and color selection | Static key-move/navigation code | Rank meaningful evaluation changes, navigate between moments, and let users focus on either player. The ranking must be independent and documented. |
| Retry mistakes and hints | Advertised welcome plus static controls; Chess.com retry not yet exercised | The independent implementation restores pre-mistake positions, accepts legal attempts, compares against the engine best move, offers hints/solutions, and advances through mistakes. Complete successful-attempt runtime verification remains required; do not infer it from the controls alone. |
| Phase report | Static report | Implemented opening/middlegame/endgame accuracy with independent phase boundaries and summaries. These do not reproduce Chess.com's phase grades or formulas. |
| Estimated game rating | Static report | Explicit gap unless an independent, calibrated estimator is implemented. A made-up rating must not be represented as recovered or equivalent to Chess.com Game Rating. |
| Opening, tactics, strategy, and endgame skill report | Static category code | Implemented independent category accuracy with per-player eligible-move counts. Opening/Endgame use phases, Tactics uses captures/checks/promotions, and Strategy uses quiet middlegame moves. Categories can overlap; empty categories show unavailable. Chess.com's advanced ratings and historical comparisons remain gaps. |
| Board annotation and review settings | Static arrow/overlay code | Offer legal move input, promotion, board flip, right-click arrows/circles, played/best move visibility, and adjustable engine depth/time/line count. |
| Persistence and export | Static save/share controls | Implemented local review saving, annotated PGN export, and a copyable plaintext summary. The PGN includes independent evaluation/classification comments. Cloud saved-analysis accounts and Chess.com social sharing integration remain gaps. |
| Practice against the computer | Static surrounding Analysis control | Independent continuation-against-engine work is in progress; its complete flow is not yet verified. |
| Opening explorer | Static surrounding Analysis identifiers | An independent explorer based on the locally imported game library is in progress. Its runtime behavior is not yet verified and it is not Chess.com's masters/openings database. |
| Shared Analysis Rooms, tablebases, recommended training | Static surrounding Analysis identifiers | Adjacent product features, with availability and full workflows unverified. They remain explicit gaps rather than implied by a working core review. |

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

The application uses independently written source, original SVG piece artwork, its own interface, chess.js legality, and the separately distributed Stockfish engine. Captured Chess.com scripts, proprietary assets, coach media, source excerpts, and the capture directory must not be committed into the application repository. The investigation informs a feature specification; it does not supply implementation code.

The signed-in Opera Game report and the listed interactions are now runtime-observed. Proprietary scoring formulas, successful Chess.com retries, Game Rating in an applicable report, every account/locale/experiment branch, and complete server behavior remain unresolved. Independent full-import and sample-review verification do not prove the pending imported-review flow or every feature in the matrix. Passing local tests or displaying similar labels does not close those evidence gaps.
