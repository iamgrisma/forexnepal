// src/main.tsx
import React from 'react'; // Make sure React is imported
import ReactDOM from 'react-dom/client'; // Use createRoot
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async'; // <-- 1. IMPORT THE PROVIDER
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

// Use createRoot
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <-- 2. WRAP YOUR APP WITH IT (outside QueryClient) --> */}
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);

// --- ALL YOUR EXISTING SERVICE WORKER CODE IS PRESERVED ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
        // Ensure the SW takes control ASAP for install eligibility
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // You can show a toast or a confirm dialog here
                // For simplicity, let's assume we can ask the user
                if (confirm('New version available! Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  // window.location.reload(); // Reload is handled by controllerchange
                }
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
      window.location.reload();
    }
  });
}
