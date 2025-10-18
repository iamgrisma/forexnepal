import { createRoot } from 'react-dom/client';
// Import BrowserRouter instead of HashRouter
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    {/* Use BrowserRouter */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);

// Service worker registration remains the same
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Optional: Prompt user to refresh
                // console.log('New content is available; please refresh.');
                // Or automatically refresh:
                 newWorker.postMessage({ type: 'SKIP_WAITING' });
                 // window.location.reload(); // Can sometimes cause issues, let controllerchange handle it
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      // Debounce reload slightly to avoid race conditions
      setTimeout(() => window.location.reload(), 50);
    }
  });
}
