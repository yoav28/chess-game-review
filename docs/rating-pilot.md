# Independent game-rating pilot

This pilot tests whether move-quality features can predict the recorded Chess.com blitz rating of players in an observed public sample. Recorded player rating is a noisy label. It is not a measured rating for that particular game, and this work does not recover Chess.com’s proprietary Game Rating calculation.

The completed pilot failed its acceptance gates. No production Game Rating estimate is enabled.

## Observed result

All 230 selected games completed engine analysis without failures and yielded 337 eligible player-game observations. The compact [dataset and validation artifact](../chess-review/src/data/rating-pilot-v1.json) reproduces the result offline.

| Partition | Observations | Independent players | Games |
| --- | ---: | ---: | ---: |
| Training | 135 | 95 | 73 |
| Interval calibration | 47 | 33 | 41 |
| Held-out test | 67 | 42 | 60 |

Held-out mean absolute error was **349.48 rating points**, compared with **370.21** for the constant median-rating baseline: a **5.6% improvement**, below the predeclared 10% requirement. The empirical 90% interval required a radius of **615.33 points** and covered **86.57%** of held-out observations.

Coverage was inadequate. Although all source games spanned ratings 100–2160, the eligible training observations covered only 100–1460. Of 460 source-side rating labels, 406 were below 800. The eight held-out observations in the 1600–1999 band had an error of 1209.22 points on average. A low error among the many beginner games would not justify estimates for stronger players.

Six gates failed: independent-player support, observation counts, improvement over baseline, maximum absolute error, interval width, and rating-band coverage. These results do not justify a broad per-game rating. A follow-up would need a separately specified, more balanced sample and a fresh held-out cohort; these test results must not be reused to tune and then claim independent validation.

The [official Game Rating guide](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review) describes that feature qualitatively. The [Published Data API documentation](https://www.chess.com/news/view/published-data-api) supplies the public source fields used here: rated status, standard rules, time class, and player ratings in monthly game archives.

## Sampling

The reproducible pilot selects accounts by SHA256 ordering from the public Italian country inventory, which returned 10,000 recently active accounts. It takes 60 accounts, then up to 39 observed one-hop opponents, and serially reads their October 2026 game archives. Each account contributes at most four deterministically ordered rated standard blitz games with 50–180 plies. Duplicate game URLs are removed. The script caps fresh HTTP attempts at 100 and caches responses with source URLs, timestamps, and SHA256 hashes.

This is a convenience sample with country, activity, month, length, and opponent-selection biases. It is not representative of every Chess.com player. Rapid, bullet, daily, Chess960, short games, and unsupported rating ranges require separate evidence.

## Analysis and features

The engine profile is pinned to Stockfish 19 lite, single thread, a depth limit of 10, 30 milliseconds per position, and two principal variations. Analysis artifacts and source PGNs remain outside the repository. The compact artifact contains numerical observations, hashed player identifiers, source game links, provenance, and validation results.

Time-limited searches can reach different depths on different machines. The artifact records the original runtime, actual-depth histogram, engine and WebAssembly hashes, and scoring/feature/calibration source hashes. Offline replay reproduces the numerical calibration from the stored features; it does not promise identical engine output after reanalysis on different hardware.

Feature extraction requires accuracy model v2, at least 12 unforced non-book decisions after the first eight plies, and at least eight decisions whose mover-relative winning-chance estimate lies between 20% and 80%. The seven features are mean winning-chance loss, root-mean-square loss, the fraction of losses above ten points, the fraction at or below half a point, mean log2 legal-move count, the contested-decision fraction, and mean loss on contested decisions. The query player’s rating is never an input feature.

Standardization uses training data only. A uniform nearest-neighbor estimator predicts the mean recorded rating of its nearest training observations. The neighbor count is fixed by the training sample size, bounded between 10 and 30. It is not tuned using held-out results.

## Validation

Player hashes determine training, interval-calibration, and test folds in a 60/20/20 allocation. Training rows require both players in the training fold. Calibration rows require a calibration player and an opponent outside the test fold. Test rows require a test player. Consequently, neither a target player nor a game can occur across partitions.

The baseline is the median training rating. The uncertainty radius is the finite-sample-adjusted 90th percentile of absolute calibration residuals. Held-out evaluation reports mean absolute error, baseline error, observed interval coverage, rating-band sample sizes, and independent-player counts. Repeated observations from the same player remain correlated, so empirical coverage is not a formal population guarantee.

The following engineering gates were declared before inspecting held-out performance:

- At least 100 training players, 30 calibration players, and 30 test players.
- At least 200 training observations and 50 observations in each remaining partition.
- At least a 10% improvement over the median-rating baseline.
- Held-out mean absolute error no greater than 250 rating points.
- Observed interval coverage of at least 85%, with a radius no greater than 500 points.
- At least ten held-out observations in at least four 400-point rating bands.

Failure of any gate keeps the estimator unavailable. Passing them would support only the measured cohort and engine profile, with the reported uncertainty; it would not establish Chess.com parity or a universal per-game Elo.

## Reproduction

From the `chess-review` directory:

```sh
npx tsx scripts/rating-sample.ts /tmp/open-file-rating-pilot 2026/10
npx tsx scripts/rating-calibrate.ts /tmp/open-file-rating-pilot src/data/rating-pilot-v1.json
npx tsx scripts/rating-replay.ts src/data/rating-pilot-v1.json
```

The first command collects public data serially. The second resumes cached engine analyses and writes validation artifacts. The third verifies the committed compact numerical dataset entirely offline. Recollecting live sources can yield different inventories or archives; source hashes identify the exact observations used by this pilot.
