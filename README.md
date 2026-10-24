# Game Review

[![Netlify Status](https://api.netlify.com/api/v1/badges/56a240d2-0f8e-4060-83db-f7052020718c/deploy-status)](https://app.netlify.com/projects/chessrev/deploys)

Review your chess games from chess.com, lichess, or PGN at [chessrev.netlify.app](https://chessrev.netlify.app/). For free!

Inspired by [wintrcat](https://www.youtube.com/watch?v=N6dIEzA--7Y).

## Screenshots

![](./screenshots/1.jpg)
![](./screenshots/2.jpg)
![](./screenshots/3.jpg)

## Built with

- [Chess.js](https://github.com/jhlywa/chess.js) - Chess Library
- [React](https://reactjs.org/)
- [Tanstack Query](https://tanstack.com/query/latest) - Async State Management
- [Zustand](https://zustand-demo.pmnd.rs/) - Global State Management
- [HeroUI](https://www.heroui.com/) - UI Library
- [Motion](https://motion.dev/) - Animation
- [Visx](https://airbnb.io/visx/) - Data Visualization

## Analysis

Settings select the bundled Stockfish engine's NNUE or classical evaluation, search depth (8–24), and review playback interval. Analysis runs locally in the browser. Higher depths can take substantially longer, especially when reviewing many games. Reviews stored in browser storage stay on that browser and device.

The interface uses local copies of Chess.com's public board, player artwork, fonts, and navigation symbols. The coach portrait and review header artwork follow the supplied Game Review screenshots.

Entering a Chess.com or Lichess username opens the latest 100 standard games. Analyze all my games can review the last day, week, or month, limited to 10, 100, 1000, or all matching games. Keep the tab open while the queue runs; stopping cancels the current analysis and keeps completed reviews. The browser keeps up to 100 recent games and their completed reviews, evicting older entries when storage fills.

Reviews use `/{id}/review?move={x}`, where `move` counts half-moves from the starting position. Refresh and browser navigation restore saved reviews at that move. These URLs require the game to be saved in the same browser. During review, click or drag pieces to explore legal alternatives, choose promotions, and see engine feedback without changing the original game. Play advances every second by default; change the interval in Settings.

Great marks the engine's best move when the second-best move loses at least 1.5 pawns of evaluation and is classified as a mistake or blunder. Since MultiPV ranks the alternatives, this also rules out a better third or later alternative at the selected search depth. Brilliant follows [Chess.com's published criteria](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc): a best or nearly best piece sacrifice, a sound resulting position, and no completely winning alternative. The implementation uses legal capture exchanges to detect a sacrifice and engine evaluations for the remaining conditions. Chess.com's exact rating-dependent algorithm is proprietary, so these labels are an approximation and can differ from Chess.com.
