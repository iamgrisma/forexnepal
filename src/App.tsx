import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; // <-- This was the typo
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import About from './pages/About';
import Contact from './pages/Contact';
import Disclosure from './pages/Disclosure';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Converter from './pages/Converter';
import Archive from './pages/Archive';
import ArchiveDetail from './pages/ArchiveDetail';
import NotFound from './pages/NotFound';
import { Toaster } from "@/components/ui/toaster"; // shadcn toaster
import { Toaster as SonnerToaster } from "@/components/ui/sonner"; // sonner toaster
import PWAInstallPrompt from './components/PWAInstallPrompt';
import HistoricalCharts from './pages/HistoricalCharts';
import CurrencyHistoricalData from './pages/CurrencyHistoricalData';
import ConverterProfitCalculator from './pages/ConverterProfitCalculator';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import AdsTxt from './pages/AdsTxt';
import Posts from './pages/Posts';
import PostDetail from './pages/PostDetail';
import PostEditor from './pages/PostEditor';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import ApiDocs from './pages/ApiDocs'; // --- 1. IMPORT THE NEW PAGE ---

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/disclosure" element={<Disclosure />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/converter" element={<Converter />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/:date" element={<ArchiveDetail />} />
          <Route path="/historical-charts" element={<HistoricalCharts />} />
          <Route path="/currency/:iso3" element={<CurrencyHistoricalData />} />
          <Route path="/profit-calculator" element={<ConverterProfitCalculator />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:slug" element={<PostDetail />} />
          
          {/* --- 2. ADD THE NEW API ROUTE --- */}
          <Route path="/api" element={<ApiDocs />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/posts/new" 
            element={
              <ProtectedRoute>
                <PostEditor />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/posts/edit/:slug" 
            element={
              <ProtectedRoute>
                <PostEditor />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/change-password" 
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            } 
          />

          {/* Special Routes */}
          <Route path="/ads.txt" element={<AdsTxt />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster />
      <SonnerToaster richColors />
      <PWAInstallPrompt />
    </QueryClientProvider>
  );
}

export default App;
