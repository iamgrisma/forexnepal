import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import ProtectedRoute from "./components/ProtectedRoute";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

// Lazy load non-critical routes
const Converter = lazy(() => import("./pages/Converter"));
const HistoricalCharts = lazy(() => import("./pages/HistoricalCharts"));
const CurrencyHistoricalData = lazy(() => import("./pages/CurrencyHistoricalData"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Disclosure = lazy(() => import("./pages/Disclosure"));
const AdsTxt = lazy(() => import("./pages/AdsTxt"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Posts = lazy(() => import("./pages/Posts"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Archive = lazy(() => import("./pages/Archive"));
const ArchiveDetail = lazy(() => import("./pages/ArchiveDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PostEditor = lazy(() => import("./pages/PostEditor"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallPrompt />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
        {/* --- Public Routes --- */}
        <Route path="/" element={<Index />} />
        <Route path="/archive" element={<Archive />} />
        {/* --- UPDATED ROUTE --- */}
        <Route path="/archive/page/*" element={<Archive />} />
        
        {/* --- UPDATED ROUTE --- */}
        <Route path="/daily-update/forex-for/*" element={<ArchiveDetail />} />
        
        <Route path="/converter" element={<Converter />} />
        <Route path="/historical-charts" element={<HistoricalCharts />} />
        <Route path="/historical-data/:currencyCode" element={<CurrencyHistoricalData />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/disclosure" element={<Disclosure />} />
        <Route path="/ads.txt" element={<AdsTxt />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/posts/:slug" element={<PostDetail />} />

        {/* --- Admin Login Route (Public) --- */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/reset-password" element={<ResetPassword />} />

        {/* --- Protected Admin Routes --- */}
        {/* The ProtectedRoute component wraps all routes that need authentication */}
        <Route element={<ProtectedRoute />}>
           {/* Define the dashboard route HERE */}
           <Route path="/admin/dashboard" element={<AdminDashboard />} />
           {/* Define the change password route HERE */}
           <Route path="/admin/change-password" element={<ChangePassword />} />
           {/* Define the post editor routes HERE */}
           <Route path="/admin/posts/new" element={<PostEditor />} />
           <Route path="/admin/posts/edit/:id" element={<PostEditor />} />
           {/* Add any other future protected admin routes inside this wrapper */}
        </Route>

        {/* --- Catch-all Not Found Route (Must be last) --- */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
