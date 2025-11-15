// iamgrisma/forexnepal/forexnepal-0e3b0b928a538dcfb4920dfab92aefdb890deb1f/src/App.tsx
import React, { lazy, Suspense } from 'react';
// Import Routes and Route
import { Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import ProtectedRoute from '@/components/ProtectedRoute';
import { Loader2 } from 'lucide-react';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Eager load critical components
import Index from './pages/Index';
import AdminLogin from './pages/AdminLogin';
import ChangePassword from './pages/ChangePassword';

// Lazy load other components
const About = lazy(() => import('./pages/About'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Archive = lazy(() => import('./pages/Archive'));
const ArchiveDetail = lazy(() => import('./pages/ArchiveDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const Converter = lazy(() => import('./pages/Converter'));
const CurrencyHistoricalData = lazy(() => import('./pages/CurrencyHistoricalData'));
const Disclosure = lazy(() => import('./pages/Disclosure'));
const HistoricalCharts = lazy(() => import('./pages/HistoricalCharts'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Posts = lazy(() => import('./pages/Posts'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const AdsTxt = lazy(() => import('./pages/AdsTxt'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PostEditor = lazy(() => import('./pages/PostEditor'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// --- ADD NEW GOOGLE CALLBACK IMPORT ---
const GoogleCallback = lazy(() => import('./pages/GoogleCallback'));

const SuspenseFallback = () => (
  <div className="flex justify-center items-center h-[80vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function App() {
  return (
    <>
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          
          {/* --- FIX: Corrected Archive Routing --- */}
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/page/:page" element={<Archive />} />
          <Route path="/archive/:date" element={<ArchiveDetail />} />
          {/* Fallback for old links, pointing to the correct component */}
          <Route path="/daily-update/forex-for/*" element={<ArchiveDetail />} />
          {/* --- END FIX --- */}

          <Route path="/contact" element={<Contact />} />
          <Route path="/converter" element={<Converter />} />
          <Route path="/historical-data/:currency" element={<CurrencyHistoricalData />} />
          <Route path="/disclosure" element={<Disclosure />} />
          <Route path="/historical-charts" element={<HistoricalCharts />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:slug" element={<PostDetail />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/ads.txt" element={<AdsTxt />} />
          
          {/* Admin Auth Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          
          {/* --- ADD NEW GOOGLE CALLBACK ROUTE --- */}
          <Route path="/admin/auth/google/callback" element={<GoogleCallback />} />

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/posts/new" element={<PostEditor />} />
            <Route path="/admin/posts/edit/:id" element={<PostEditor />} />
            <Route path="/admin/change-password" element={<ChangePassword />} />
          </Route>

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster />
      <SonnerToaster position="top-right" richColors />
      <PWAInstallPrompt />
    </>
  );
}

export default App;
