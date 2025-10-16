import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchForexRates, fetchPreviousDayRates, formatDateLong } from '../services/forexService';
import { Rate, RatesData } from '../types/forex';
import ForexTable from '../components/ForexTable';
import ForexTicker from '../components/ForexTicker';
import CurrencyCard from '../components/CurrencyCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Gitlab, List, Grid3X3, Download, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import AdSense from '@/components/AdSense';
import html2canvas from 'html2canvas';

const Index = () => {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [popularCurrencies, setPopularCurrencies] = useState<Rate[]>([]);
  const [asianCurrencies, setAsianCurrencies] = useState<Rate[]>([]);
  const [europeanCurrencies, setEuropeanCurrencies] = useState<Rate[]>([]);
  const [middleEastCurrencies, setMiddleEastCurrencies] = useState<Rate[]>([]);
  const [otherCurrencies, setOtherCurrencies] = useState<Rate[]>([]);
  const [previousDayRates, setPreviousDayRates] = useState<Rate[]>([]);
  const { toast } = useToast();
  
  const { 
    data: forexData, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['forexRates'],
    queryFn: fetchForexRates,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const { 
    data: prevDayData,
  } = useQuery({
    queryKey: ['previousDayRates'],
    queryFn: fetchPreviousDayRates,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  useEffect(() => {
    if (isError && error instanceof Error) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);
  
  useEffect(() => {
    if (prevDayData?.data?.payload?.[0]?.rates) {
      setPreviousDayRates(prevDayData.data.payload[0].rates);
    }
  }, [prevDayData]);
  
  useEffect(() => {
    if (forexData?.data?.payload?.[0]?.rates) {
      const allRates = forexData.data.payload[0].rates;
      
      // Define currency categories
      const popularCodes = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF'];
      const asianCodes = ['JPY', 'CNY', 'SGD', 'HKD', 'MYR', 'KRW', 'THB', 'INR'];
      const europeanCodes = ['EUR', 'GBP', 'CHF', 'SEK', 'DKK'];
      const middleEastCodes = ['SAR', 'QAR', 'AED', 'KWD', 'BHD', 'OMR'];
      
      // Filter rates to get categorized currencies
      const popular = allRates.filter(rate => popularCodes.includes(rate.currency.iso3));
      const asian = allRates.filter(rate => asianCodes.includes(rate.currency.iso3));
      const european = allRates.filter(rate => europeanCodes.includes(rate.currency.iso3));
      const middleEast = allRates.filter(rate => middleEastCodes.includes(rate.currency.iso3));
      
      // Other currencies (not in any other category)
      const allCategorizedCodes = [...new Set([...popularCodes, ...asianCodes, ...europeanCodes, ...middleEastCodes])];
      const others = allRates.filter(rate => !allCategorizedCodes.includes(rate.currency.iso3));
      
      setPopularCurrencies(popular);
      setAsianCurrencies(asian);
      setEuropeanCurrencies(european);
      setMiddleEastCurrencies(middleEast);
      setOtherCurrencies(others);

      // Check and generate OG image if needed (in background)
      checkAndGenerateOGImage();
    }
  }, [forexData]);

  const handleRefresh = async () => {
    toast({
      title: "Refreshing data",
      description: "Fetching the latest forex rates...",
    });
    await refetch();
  };

  const checkAndGenerateOGImage = async () => {
    try {
      // Check if OG image exists and is recent (within 24 hours)
      const { data: files } = await supabase.storage
        .from('forex-images')
        .list('', {
          search: 'og-image-latest.png'
        });

      const ogImage = files?.[0];
      const now = new Date();
      const imageAge = ogImage ? now.getTime() - new Date(ogImage.created_at).getTime() : Infinity;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // Only generate if image doesn't exist or is older than 24 hours
      if (!ogImage || imageAge > twentyFourHours) {
        // Wait a bit for the DOM to be ready
        setTimeout(async () => {
          try {
            const canvas = await generateImageFromContent('forex-table-container', 1200, 630, true);
            if (canvas) {
              const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => resolve(blob!), 'image/png');
              });

              await supabase.storage
                .from('forex-images')
                .upload('og-image-latest.png', blob, {
                  contentType: 'image/png',
                  upsert: true,
                  cacheControl: '3600'
                });

              console.log('OG image generated and uploaded successfully');
            }
          } catch (error) {
            console.error('Background OG image generation failed:', error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking OG image:', error);
    }
  };

  const generateImageFromContent = async (contentId: string, width: number = 1500, height?: number, forOG: boolean = false) => {
    const container = document.getElementById(contentId);
    if (!container) return null;

    const wrapper = document.createElement('div');
    wrapper.style.width = `${width}px`;
    wrapper.style.padding = forOG ? '30px' : '40px';
    wrapper.style.backgroundColor = 'white';
    wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    const titleEl = document.createElement('h1');
    titleEl.style.textAlign = 'center';
    titleEl.style.fontSize = forOG ? '28px' : '32px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.marginBottom = forOG ? '20px' : '30px';
    titleEl.style.color = '#1f2937';
    const dateStr = ratesData?.date ? new Date(ratesData.date).toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    }) : new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    titleEl.textContent = `Foreign Exchange Rate for Nepali Currencies on ${dateStr}`;
    wrapper.appendChild(titleEl);

    const contentClone = container.cloneNode(true) as HTMLElement;
    contentClone.style.fontSize = forOG ? '14px' : '16px';
    wrapper.appendChild(contentClone);

    const footer = document.createElement('div');
    footer.style.marginTop = forOG ? '20px' : '30px';
    footer.style.textAlign = 'center';
    footer.style.fontSize = forOG ? '12px' : '14px';
    footer.style.color = '#6b7280';
    
    const source = document.createElement('p');
    source.style.marginBottom = '10px';
    source.style.fontWeight = '600';
    const lastUpdated = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    source.textContent = `Source: Nepal Rastra Bank (NRB) | Last updated: ${lastUpdated}`;
    footer.appendChild(source);

    if (!forOG) {
      const disclaimer = document.createElement('p');
      disclaimer.style.fontStyle = 'italic';
      disclaimer.style.fontSize = '12px';
      disclaimer.textContent = 'Rates are subject to change. Please verify with your financial institution before conducting transactions.';
      footer.appendChild(disclaimer);
    }
    
    const designer = document.createElement('p');
    designer.style.fontStyle = 'italic';
    designer.style.fontSize = forOG ? '10px' : '12px';
    designer.style.marginTop = '10px';
    designer.style.color = '#4b5563';
    designer.textContent = 'Data extraction and presentation designed by Grisma Bhandari';
    footer.appendChild(designer);

    wrapper.appendChild(footer);

    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: forOG ? 1200 : width,
        height: height || wrapper.offsetHeight
      });

      document.body.removeChild(wrapper);
      return canvas;
    } catch (error) {
      document.body.removeChild(wrapper);
      throw error;
    }
  };

  const downloadTableAsImage = async () => {
    const contentId = viewMode === 'table' ? 'forex-table-container' : 'forex-grid-container';
    if (!document.getElementById(contentId)) return;

    try {
      const canvas = await generateImageFromContent(contentId);
      if (!canvas) {
        throw new Error('Failed to generate image');
      }

      const link = document.createElement('a');
      link.download = `forex-rates-${viewMode}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: "Success",
        description: `${viewMode === 'table' ? 'Table' : 'Grid'} downloaded as image`,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: "Failed to download as image",
        variant: "destructive",
      });
    }
  };

  const generateAndUploadOGImage = async () => {
    toast({
      title: "Generating share image",
      description: "Please wait while we create the image...",
    });

    try {
      const canvas = await generateImageFromContent('forex-table-container', 1200, 630, true);
      if (!canvas) {
        throw new Error('Failed to generate image');
      }

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      // Use a consistent filename so the URL doesn't change
      const fileName = 'og-image-latest.png';
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('forex-images')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('forex-images')
        .getPublicUrl(fileName);

      // Update meta tag dynamically
      const ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (ogImageMeta) {
        ogImageMeta.setAttribute('content', `${publicUrl}?t=${Date.now()}`);
      }

      // Copy to clipboard for sharing
      await navigator.clipboard.writeText(`${window.location.origin}\n\nCheck out today's forex rates!`);

      toast({
        title: "Success",
        description: "Share link copied to clipboard! OG image updated.",
      });
    } catch (error) {
      console.error('Error generating OG image:', error);
      toast({
        title: "Error",
        description: "Failed to generate share image",
        variant: "destructive",
      });
    }
  };

  const ratesData: RatesData | undefined = forexData?.data?.payload?.[0];
  const rates: Rate[] = ratesData?.rates || [];
  
  let title = "Foreign Exchange Rates";
  if (ratesData?.date) {
    const headerDate = new Date(ratesData.date);
    title = `Foreign Exchange Rates as Per Nepal Rastra Bank for ${formatDateLong(headerDate)}`;
  }

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
              <Gitlab className="h-4 w-4 mr-1" />
              <span>Live Forex Data</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Nepal Rastra Bank</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Track real-time foreign exchange rates with beautiful visualizations and seamless updates.
            </p>
          </div>
          
          <div className="flex justify-end mb-6 gap-2">
            <Button 
              onClick={generateAndUploadOGImage} 
              variant="outline"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors"
              disabled={isLoading || rates.length === 0}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button 
              onClick={downloadTableAsImage} 
              variant="outline"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors"
              disabled={isLoading || rates.length === 0}
            >
              <Download className="h-4 w-4" />
              Download {viewMode === 'table' ? 'Table' : 'Grid'}
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-1 flex">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-md"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-md"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Grid
              </Button>
            </div>
          </div>
          
          {/* Ticker component */}
          <ForexTicker rates={rates} isLoading={isLoading} />
          
          <Tabs defaultValue="all" className="mb-12">
            <TabsList className="mb-8 w-full lg:w-auto bg-white/80 backdrop-blur-sm border border-gray-100">
              <TabsTrigger value="all">All Currencies</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="asian">Asian</TabsTrigger>
              <TabsTrigger value="european">European</TabsTrigger>
              <TabsTrigger value="middle-east">Middle East</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable
                    rates={rates}
                    isLoading={isLoading}
                    title={title}
                    previousDayRates={previousDayRates}
                  />
                </div>
              ) : (
                <div id="forex-grid-container" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {isLoading ? (
                    Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    rates.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} previousDayRates={previousDayRates} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="popular" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable
                  rates={popularCurrencies}
                  isLoading={isLoading}
                  title="Popular Foreign Currencies"
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    popularCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} previousDayRates={previousDayRates} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="asian" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable
                  rates={asianCurrencies}
                  isLoading={isLoading}
                  title="Asian Currencies"
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    asianCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} previousDayRates={previousDayRates} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="european" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable
                  rates={europeanCurrencies}
                  isLoading={isLoading}
                  title="European Currencies"
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    europeanCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} previousDayRates={previousDayRates} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="middle-east" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable
                  rates={middleEastCurrencies}
                  isLoading={isLoading}
                  title="Middle East Currencies"
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    middleEastCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} previousDayRates={previousDayRates} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="other" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable
                  rates={otherCurrencies}
                  isLoading={isLoading}
                  title="Other Currencies"
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    otherCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} previousDayRates={previousDayRates} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          {/* Introduction about forex rates */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-100">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">About Nepal's Foreign Exchange Rates</h2>
            <p className="text-gray-600 leading-relaxed">
              The foreign exchange rates displayed here are the official rates published by Nepal Rastra Bank (NRB), 
              Nepal's central bank. These rates are primarily influenced by Nepal's trade relationships, remittance flows, 
              and the country's foreign exchange reserves. The Nepalese Rupee (NPR) is pegged to the Indian Rupee (INR) 
              at a fixed rate, while other currency rates fluctuate based on international market conditions and Nepal's 
              economic fundamentals. These rates are used by banks, financial institutions, and money exchangers across Nepal 
              for foreign currency transactions.
            </p>
          </div>
          
          <AdSense />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
