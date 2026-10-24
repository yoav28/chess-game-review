import { Button } from '@heroui/react';
import { ErrorBoundary } from 'react-error-boundary';

import Board from './components/board/Board';
import BatchProgress from './components/controls/BatchProgress';
import Controls from './components/controls/Controls';
import Settings from './components/controls/Settings';
import Sidebar from './components/layout/Sidebar';
import useBatchReview from './hooks/useBatchReview';
import useReviewSession from './hooks/useReviewSession';

export default function App() {
  const { routeError, dismissRouteError } = useReviewSession();
  useBatchReview();

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <Sidebar />
      <main className="site-main" id="App">
        <div className="workspace-messages">
          <BatchProgress />
          {routeError && (
            <div className="workspace-error" role="alert">
              <p>{routeError}</p>
              <Button onPress={dismissRouteError} size="sm">Home</Button>
            </div>
          )}
        </div>
        <div className="game-workspace">
          <Board />
          <div className="board-tools"><Settings /></div>
          <Controls />
        </div>
      </main>
    </ErrorBoundary>
  );
}

function Fallback({ error }: { error: Error }) {
  return (
    <div className="flex h-screen flex-col gap-2 p-8" role="alert">
      <p className="text-2xl">Something went wrong:</p>
      <code className="inline-block text-small text-danger-500">
        {error.message}
      </code>
      <div className="flex gap-1">
        <Button
          onPress={() => {
            window.location.reload();
          }}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
