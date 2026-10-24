import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { HeroUIProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
          <App />
        </HelmetProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
