
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/converter" element={<Converter />} />
        <Route path="/historical-charts" element={<HistoricalCharts />} />
        <Route path="/historical-data/:currencyCode" element={<CurrencyHistoricalData />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/disclosure" element={<Disclosure />} />
        <Route path="/ads.txt" element={<AdsTxt />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
