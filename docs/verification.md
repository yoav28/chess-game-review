# Verification — 24 October 2026

The implementation is an independent reconstruction informed by REA and interactive inspection. These checks verify the implemented flows; they do not prove complete Chess.com feature parity.

## Automated checks

- `npm test` in `chess-review/`: 77 passing tests, zero failures. Coverage includes real Stockfish UCI analysis, mate/draw evaluation, history and repetition, cancellation and stale requests, complete archive import, PGN special moves and clocks, explorer transpositions, play-against-engine state, conceptual coaching, and export consistency.
- `npm run build`: TypeScript and the Vite production build succeeded. The deployment includes the single-threaded Stockfish JavaScript, WebAssembly, license, and source information.

## Codex browser checks

| Flow | Observed result |
| --- | --- |
| Complete username import | MagnusCarlsen: all 67 returned monthly archives completed; 9,973 public games were available in the library. |
| Saved library and review | Reimporting restored saved games during refresh. An imported game's completed review reopened from IndexedDB. |
| Fresh imported-game analysis | Toxicmybrother vs MagnusCarlsen, 77 plies: a new 78-position review completed at depth limit 16 / 0.5 seconds per position. The resulting independent accuracy values were 96.1 and 94.3. Actual achieved search depth and scores can vary with the device and budget. |
| Retry practice | The move-16 position before Rxe7 offered a d1 hint and Qf3 solution. Playing Qf3 was accepted; a3 produced retry feedback. |
| Live analysis | Three scored legal candidate lines appeared. Selecting e4 created a playable variation and returning restored the recorded position. |
| Play against engine | Starting after e4 as Black accepted e5, Stockfish replied Nf3, and Undo removed the user/reply pair while preserving the starting position. |
| Full-library explorer | All 9,973 records were scanned. It reported 9,648 valid standard games and 325 skipped variants/invalid records. Initial-position continuations included e4, d4, Nf3 and others with actual counts, results and average ratings. Selecting d4 updated the analysis board. |
| Settings modal | The native dialog opened and Escape closed it. A background game review continued and completed. |
| Mobile layout | At the 390 × 844 viewport override, the document and body widths matched; no horizontal overflow was observed. The full board, mobile library drawer, and PGN dialog were usable. The override was reset afterward. |
| FEN and underpromotion | `7k/P7/8/8/8/8/8/7K w - - 0 1` loaded as a position. Promotion exposed all four accessible piece choices; selecting a knight produced a white knight on a8 and variation `a8=N`. |
| Reviewed PGN download | The browser downloaded the imported game's reviewed PGN. Reopening that file through chess.js recovered all 77 plies, the 1-0 result, 78 annotated positions, and clock annotations. |

The authenticated Chess.com comparison is recorded separately in [the REA investigation](chess-com-review-research.md). Proprietary scoring, game-rating prediction, private cloud services, shared analysis rooms, tablebases, and recommended training remain outside the implemented feature set.

## Private deployment

Sites confirmed a successful private deployment at [Open File](https://open-file-chess-review.woolly-rice-1868.chatgpt.site), built from pushed Site-source commit `7f33529f2e54c320050a6ccdcad1356b143ccb64`. The release checkout passed the same 77 tests and production build; its generated asset filenames and sizes matched the working checkout's build.

Opening the deployed URL in the Codex browser reached its expected ChatGPT sign-in gate. The browser did not have an OpenAI login session, so hosted engine execution was not verified beyond that gate. The interactive engine checks above were performed against the local application. No app access was made public.
