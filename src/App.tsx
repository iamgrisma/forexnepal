import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// HashRouter is already correctly imported in your main.tsx
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Converter from "./pages/Converter";
import HistoricalCharts from "./pages/HistoricalCharts";
import CurrencyHistoricalData from "./pages/CurrencyHistoricalData";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Disclosure from "./pages/Disclosure";
import AdsTxt from "./pages/AdsTxt";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import Posts from "./pages/Posts";
import PostDetail from "./pages/PostDetail";
import ChangePassword from "./pages/ChangePassword";
import Archive from "./pages/Archive";
import ArchiveDetail from "./pages/ArchiveDetail";

// --- Ensure these imports are correct ---
import ProtectedRoute from "./components/ProtectedRoute"; // Import the guard
import AdminDashboard from "./pages/AdminDashboard";    // Import the dashboard page
import PostEditor from "./pages/PostEditor";        // Import the editor page
// --- End Ensure imports ---

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* HashRouter should wrap this in main.tsx */}
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/" element={<Index />} />
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
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/page-:pageNumber" element={<Archive />} />
        <Route path="/archive/:date" element={<ArchiveDetail />} />

        {/* --- Admin Login Route (Public) --- */}
        <Route path="/admin/login" element={<AdminLogin />} />

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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
