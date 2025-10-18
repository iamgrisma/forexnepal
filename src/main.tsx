import { createRoot } from 'react-dom/client';
// Import HashRouter instead of BrowserRouter
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    {/* Use HashRouter */}
    <HashRouter>
      <App />
    </HashRouter>
  </QueryClientProvider>
);

// Service worker registration remains the same
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
        // ... (rest of service worker logic)
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      setTimeout(() => window.location.reload(), 50);
    }
  });
}
