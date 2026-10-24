# Lichess opening names

Source: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings/tree/a6189a30dc273ccb21fc2536a9a2fefd5592a67a), pinned to commit a6189a30dc273ccb21fc2536a9a2fefd5592a67a.

The upstream project dedicates its opening facts and copyrightable contributions to the public domain under CC0 1.0. The complete dedication is preserved in [CC0-1.0.txt](CC0-1.0.txt). File URLs, SHA-256 digests, validation counts, and the matching rule are recorded in [provenance.json](provenance.json).

All 3865 source PGNs were parsed strictly and legally replayed with chess.js before generating the 8802-node UCI trie. The runtime uses prevalidated canonical SAN edges and does not parse PGNs. Opening names and ECO codes retain upstream spelling. Book means an exact registered prefix, not a claim that a move is objectively best. The last named ancestor remains visible after a deviation, while book becomes false.

Regenerate from the app directory with:

```sh
node scripts/update-openings.mjs a6189a30dc273ccb21fc2536a9a2fefd5592a67a
```
