import { useState } from 'react';

import useLocalStorage from '../../hooks/useLocalStorage';
import ChessCom from '../../icons/game-src/ChessCom';
import Lichess from '../../icons/game-src/Lichess';
import Pgn from '../../icons/game-src/Pgn';
import ChessSiteForm from './ChessSiteForm';
import PGNForm from './PGNForm';
import RecentReviews from './RecentReviews';

import '../../styles/imports.css';

const sources = [
  { id: 'chess.com', label: 'Chess.com', Icon: ChessCom },
  { id: 'lichess', label: 'Lichess', Icon: Lichess },
  { id: 'pgn', label: 'PGN', Icon: Pgn },
] as const;

export default function Forms() {
  const { item: gameInput, set } = useLocalStorage('game-input');
  const [source, setSource] = useState(sources.some(item => item.id === gameInput) ? gameInput : 'pgn');

  return (
    <div className="game-import">
      <div aria-label="Import a game from" className="import-tabs" role="tablist">
        {sources.map(({ id, label, Icon }) => (
          <button
            aria-controls="import-source-panel"
            aria-selected={source === id}
            className="import-tab"
            id={`import-source-${id}`}
            key={id}
            onClick={() => {
              setSource(id);
              set('game-input', id);
            }}
            role="tab"
            type="button"
          >
            <Icon className="import-source-icon" />
            {label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`import-source-${source}`}
        className="import-source-panel"
        id="import-source-panel"
        role="tabpanel"
      >
        {source === 'pgn' ? <PGNForm /> : <ChessSiteForm key={source} site={source === 'lichess' ? 'lichess' : 'chess.com'} />}
      </div>
      <RecentReviews />
    </div>
  );
}
