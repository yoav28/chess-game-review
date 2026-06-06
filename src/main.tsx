import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { HeroUIProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';

import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider disableRipple>
        <HelmetProvider>
          <main className={`
            relative
            lg:h-screen
          `}
          >
            <div className={`
              absolute hidden h-full w-full overflow-hidden
              mask-radial-[100%_100%] mask-radial-from-25% mask-radial-at-center
              sm:block
            `}
            >
              <img
                alt="background gradient"
                className="absolute top-1/5 left-1/2 w-screen"
                src="/gradient.png"
              />
            </div>
            <App />
          </main>
        </HelmetProvider>
      </HeroUIProvider>
      {import.meta.env.PROD || <ReactQueryDevtools initialIsOpen={false} /> }
    </QueryClientProvider>
  </React.StrictMode>,
);
