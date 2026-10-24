import { Button } from '@heroui/react';
import { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import Board from './components/board/Board';
import BatchProgress from './components/controls/BatchProgress';
import Controls from './components/controls/Controls';
import useBatchReview from './hooks/useBatchReview';
import useReviewSession from './hooks/useReviewSession';

export default function App() {
  const { routeError, dismissRouteError } = useReviewSession();
  useBatchReview();

  useEffect(() => {
    const root = document.getElementById('root');
    if (root)
      root.role = 'presentation';
  }, []);

  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <div
        className={`
          mx-auto h-full overflow-scroll p-3
          xs:p-6
        `}
        id="App"
      >
        <BatchProgress />
        {routeError && (
          <div className="mx-auto mb-4 flex max-w-[1146px] items-center gap-3" role="alert">
            <p className="text-small">{routeError}</p>
            <Button onPress={dismissRouteError} size="sm">Home</Button>
          </div>
        )}
        <div className={`
          relative mx-auto flex max-w-[642px] flex-col justify-center gap-6
          lg:max-w-none lg:flex-row
        `}
        >
          <Board />
          <Controls />
        </div>
      </div>
    </ErrorBoundary>
  );
}

// eslint-disable-next-line unused-imports/no-unused-vars
function Fallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => any }) {
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
