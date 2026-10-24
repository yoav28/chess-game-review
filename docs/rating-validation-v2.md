# Stratified game-rating validation v2

## Sampling plan frozen before collection

This is a new study. The first pilot, its numerical observations, validation results, code hashes, and failed acceptance decision remain unchanged. V2 changes sampling rather than the estimator, features, engine profile, scoring model, or acceptance gates.

The target is up to 800 public rated standard blitz games from September 2026. Six equally weighted primary rating strata are 400–799, 800–1199, 1200–1599, 1600–1999, 2000–2399, and 2400–2799. Additional 100–399 and 2800+ support will be reported separately when available and will not replace missing primary strata. Strata use recorded archive ratings, not assumed strength from a public name or title.

Discovery uses the documented public [streamer inventory](https://api.chess.com/pub/streamers), [leaderboards](https://api.chess.com/pub/leaderboards), and the public accounts erik, DanielRensch, AnnaCramling, and ChessNetwork. Streamer and leaderboard membership is a convenience sampling frame, not the full player population. Recorded ratings and time controls are verified from each account’s September archive. Expansion is restricted to one-hop opponents observed in the discovery accounts’ eligible games.

All HTTP requests run serially. At most 250 fresh HTTP attempts are permitted, including retries, across a persisted collection ledger. Responses are cached with URL, retrieval time, status, and SHA256. A timeout or retry cannot silently reset the budget. No private account information, credentials, or authenticated endpoints are used.

A new fixed sampling salt, `rating-stratified-v2`, determines candidate ordering. It does not change the existing fixed player-fold function. Four named accounts are examined first, followed by a deterministic mix of streamer and leaderboard accounts. Once discovery archives are collected, one-hop expansion prioritizes underrepresented recorded-rating strata using metadata only. It never uses engine scores, model predictions, or held-out residuals.

Eligible games must be rated, standard chess, blitz, legally replayable, and contain 50–180 plies. Duplicate URLs are removed. The final corpus permits no more than six appearances by any player, including opponent appearances. Selection balances recorded-rating labels across the six primary strata, with deterministic ordering within a stratum and a hard maximum of 800 games. The exact achieved counts, shortfalls, and all rejected categories will be reported.

## Freshness and leakage controls

Every player hash in the v1 observation artifact, including opponent hashes, is considered previously observed. The local v1 raw-game cache supplies any additional source players whose games produced no eligible numerical observation. V2 excludes games containing any such player from the entire final corpus. If the supplemental raw cache is unavailable, collection reports that weaker freshness boundary rather than claiming all original source players were excluded.

The original fixed `rating-pilot-v1` player-fold salt and 60/20/20 assignment stay unchanged. Training requires both players in the training fold. Interval calibration requires a calibration player and an opponent outside the test fold. Test rows require a test player. No player or game can cross these partitions. A different salt will not be selected to improve counts or outcomes.

## Metadata gate before engine work

The source cohort is frozen and summarized before any engine analysis or fitting. Each primary stratum must supply at least 40 potential training observations from ten players, 15 calibration observations from five players, and 15 test observations from five players. Overall metadata support must also meet the existing minimums of 200 training observations/100 players, 50 calibration observations/30 players, and 50 test observations/30 players.

These are pre-engine potential observations. Feature extraction can subsequently reject games with too few unforced non-book or contested decisions, so passing this gate does not imply that final validation support will pass. If collection reaches its fixed HTTP budget without adequate source coverage, engine work stops and the shortfall is reported for review.

## Frozen analysis and acceptance

If the source cohort is approved after the metadata gate, analysis reuses the existing Stockfish 19 lite single-thread profile, depth limit 10, 30 milliseconds per position, MultiPV 2, win-chance accuracy v2, seven-feature extractor, standardized uniform nearest-neighbor model, fixed neighbor-count rule, player-separated interval calibration, and all original acceptance gates. No model or gate is tuned against v2 held-out outcomes.

The original gates require 100/30/30 independent players and 200/50/50 observations across training/calibration/test, a held-out MAE no greater than 250 rating points, at least a 10% improvement over the training-median baseline, empirical interval coverage of at least 85% with a radius no greater than 500 points, and ten test observations in four distinct 400-point bands.

Recorded player rating remains a noisy proxy for move quality, not measured single-game performance. Time-limited engine output depends on hardware. No UI Game Rating is enabled unless validation succeeds and the production input has the supported population, feature support, and engine profile. No proprietary Chess.com formula is claimed.

## Cohort result

The fixed 250-request collection produced 800 games from 970 distinct players, with no more than six appearances per player. It excluded all 287 prior-player hashes recovered from v1 observations and the supplemental raw cache. The frozen metadata gate passed before engine analysis began.

| Rating band | Labels | Potential training | Potential calibration | Potential test |
| --- | ---: | ---: | ---: | ---: |
| 400–799 | 265 | 89 | 31 | 60 |
| 800–1199 | 260 | 74 | 36 | 70 |
| 1200–1599 | 266 | 100 | 29 | 57 |
| 1600–1999 | 266 | 102 | 50 | 38 |
| 2000–2399 | 266 | 82 | 62 | 50 |
| 2400–2799 | 266 | 88 | 42 | 59 |

Overall potential partitions contain 538 training observations from 362 players, 252 calibration observations from 160 players, and 334 test observations from 197 players. These counts precede engine-feature eligibility; they do not establish prediction accuracy. The metadata cohort is retained in `chess-review/src/data/rating-stratified-v2-cohort.json` with source hashes and the frozen plan digest.

## Completed validation

All 800 games completed engine review with zero failures and yielded 1,507 eligible player-game observations. The final isolated partitions contained 500 training observations from 342 players, 241 interval-calibration observations from 154 players, and 315 test observations from 190 players. Mixed-fold opponent rows are intentionally excluded under the frozen leakage controls.

Held-out mean absolute error was **495.80 rating points**, compared with **593.37** for the constant training-median baseline, a 16.4% improvement. The empirical 90% interval required **±906.35 points** and covered **88.25%** of held-out observations. Training labels ranged from 473 to 3,204, but the six primary test bands were 400–2,799; there was no held-out validation below 400 or at 2,800 and above.

The study passed the sample-size, independent-player, rating-band, baseline-improvement, and empirical-coverage checks. It failed the unchanged maximum-error and interval-width gates. **No production rating estimate is enabled.** Broader source coverage did not make these seven features and this estimator sufficiently accurate. This result does not justify simply collecting more of the same data or displaying a point estimate without a better validated method.

The [numerical results](../chess-review/src/data/rating-stratified-v2-results.json) include source/code/engine hashes and can be verified without network or engine work:

```sh
cd chess-review
npx tsx scripts/rating-replay.ts src/data/rating-stratified-v2-results.json
```

Offline replay returned `verified: true` and reproduced both failed gates. The v1 and v2 results concern different convenience samples; their raw errors are not a like-for-like longitudinal comparison.
