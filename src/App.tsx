import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// Import Admin components
import ProtectedRoute from "./components/ProtectedRoute"; // Import the guard
import AdminDashboard from "./pages/AdminDashboard";
import PostEditor from "./pages/PostEditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        {/* Public Routes */}
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

        {/* Admin Login Route */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute />}>
           <Route path="/admin/dashboard" element={<AdminDashboard />} />
           <Route path="/admin/posts/new" element={<PostEditor />} /> {/* Route for creating new post */}
           <Route path="/admin/posts/edit/:id" element={<PostEditor />} /> {/* Route for editing existing post */}
           {/* Add other protected admin routes here if needed */}
        </Route>

        {/* Catch-all Not Found Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
