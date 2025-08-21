import Layout from '@/components/Layout';
import { FileText, Download, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const AdsTxt = () => {
  const { toast } = useToast();

  const adsTxtContent = `#Ads.txt grisma.com.np
#Ads.txt managed by AdsTxtManager.com - the free ads.txt management tool for publishers
ownerdomain=grisma.com.np

ezoic.ai, 515fac9d412f802bd231607a03c74761, DIRECT
#35
themediagrid.com, 4M5PGT, DIRECT, 35d5010d7789b49d
themediagrid.com, Q19AKF, DIRECT, 35d5010d7789b49d
sonobi.com, 192ecdea01, RESELLER, d1a215d9eb5aee9e
google.com, pub-6644558441501035, DIRECT, f08c47fec0942fa0
google.com, pub-1175987143200523, RESELLER, f08c47fec0942fa0
#36
sharethrough.com, PmzCMtAd, DIRECT, d53b998a7bd4ecd2
google.com, pub-9508156287817487, RESELLER, f08c47fec0942fa0
improvedigital.com, 2483, RESELLER
inmobi.com, 6b1465d6abe84397bf7baad04aaee1f1, DIRECT, 83e75a7ae333ca9d
sonobi.com, c2988be809, RESELLER, d1a215d9eb5aee9e
#10015
openx.com, 540310748, DIRECT, 6a698e2ec38604c6
openx.com, 537121708, DIRECT, 6a698e2ec38604c6
openx.com, 558427428, DIRECT, 6a698e2ec38604c6
openx.com, 559783383, DIRECT, 6a698e2ec38604c6
#10017
lijit.com, 62299-eb, DIRECT, fafdf38b16bf6b2b
lijit.com, 62299, DIRECT, fafdf38b16bf6b2b
#10033
yahoo.com, 55771, RESELLER, e1a5b5b6e3255540
conversantmedia.com, 29686, DIRECT, 03113cd04947736d
#10048
sonobi.com, f4e5b5299c, DIRECT, d1a215d9eb5aee9e
#10050
themediagrid.com, 2RT75Y, DIRECT, 35d5010d7789b49d
criteo.com, B-062427, DIRECT, 9fac4a4a87c2a44f
#10061
pubmatic.com, 156983, DIRECT, 5d62403b186f2ace
pubmatic.com, 160020, DIRECT, 5d62403b186f2ace
pubmatic.com, 162833, DIRECT, 5d62403b186f2ace
#10079
gumgum.com, 13457, DIRECT, ffdef49475d318a9
#10082
indexexchange.com, 187973, DIRECT, 50b1c356f2c5c8fc
indexexchange.com, 188161, DIRECT, 50b1c356f2c5c8fc
#10087
appnexus.com, 7620, DIRECT
#10097
video.unrulymedia.com, 3149050999, DIRECT
video.unrulymedia.com, 1346664749, DIRECT
video.unrulymedia.com, 469403698, DIRECT
#11291
onetag.com, 62499636face9dc, DIRECT
onetag.com, 62499636face9dc-OB, DIRECT
#11294
onlinemediasolutions.com, 20305, DIRECT
#11296
triplelift.com, 9733, DIRECT, 6c33edb13117fd86
themediagrid.com, GODNC4, RESELLER, 35d5010d7789b49d
#11297
teads.tv, 13877, DIRECT, 15a9c44f6d26cbe1
#11301
contextweb.com, 562406, DIRECT, 89ff185a4c4e857c
#11309
sharethrough.com, b18911a2, DIRECT, d53b998a7bd4ecd2
smaato.com, 1100047713, RESELLER, 07bcf65f187117b4
sharethrough.com, zhQZ2Tfv, DIRECT, d53b998a7bd4ecd2
#11314
adyoulike.com, ad8c19559e1f2d3424eb0be801d8e184, DIRECT
#11315
yieldmo.com, 2834292204858450860, DIRECT
rubiconproject.com, 17070, RESELLER, 0bfd66d529a55807
video.unrulymedia.com, 3463482822, RESELLER
#11321
33across.com, 0010b00002MpnPqAAJ, DIRECT, bbea06d9c4d2853c
#11325
risecodes.com, 608fee2f84a3a300011acd3f, DIRECT
#11335
smartadserver.com, 4503-OB, DIRECT, 060d053dcf45cbf3
smartadserver.com, 4503, DIRECT, 060d053dcf45cbf3
google.com, pub-5410507143596599, DIRECT, f08c47fec0942fa0`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(adsTxtContent);
      toast({
        title: "Copied!",
        description: "Ads.txt content copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please select and copy manually",
        variant: "destructive"
      });
    }
  };

  const downloadFile = () => {
    const blob = new Blob([adsTxtContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'ads.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: "Download started",
      description: "Ads.txt file is being downloaded",
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-2">Ads.txt File</h1>
          <p className="text-muted-foreground">Authorized digital sellers for grisma.com.np</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ads.txt Content</CardTitle>
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button onClick={downloadFile} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md">
              <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                {adsTxtContent}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-muted-foreground text-sm">
          <p>This file declares the authorized digital sellers for advertising inventory on grisma.com.np</p>
          <p className="mt-2">
            Learn more about ads.txt at{' '}
            <a 
              href="https://iabtechlab.com/ads-txt/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              IAB Tech Lab
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default AdsTxt;