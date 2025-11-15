// src/components/ApiEmbedPreview.tsx
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ApiEmbedPreviewProps {
  htmlContent: string;
}

const ApiEmbedPreview: React.FC<ApiEmbedPreviewProps> = ({ htmlContent }) => {
  const [showPreview, setShowPreview] = useState(false);

  // Create a sandboxed iframe source
  const iframeSrc = useMemo(() => {
    try {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      return URL.createObjectURL(blob);
    } catch (e) {
      // Fallback for environments where createObjectURL is not available (though unlikely)
      return `data:text/html,${encodeURIComponent(htmlContent)}`;
    }
  }, [htmlContent]);

  // Clean up the object URL when the component unmounts
  React.useEffect(() => {
    return () => {
      if (iframeSrc.startsWith('blob:')) {
        URL.revokeObjectURL(iframeSrc);
      }
    };
  }, [iframeSrc]);

  return (
    <div className="mt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPreview(!showPreview)}
      >
        {showPreview ? (
          <EyeOff className="mr-2 h-4 w-4" />
        ) : (
          <Eye className="mr-2 h-4 w-4" />
        )}
        {showPreview ? 'Hide Preview' : 'Show Preview'}
      </Button>

      {showPreview && (
        <Card className="mt-4 overflow-hidden">
          <CardContent className="p-0">
            <iframe
              src={iframeSrc}
              title="Embed Preview"
              className="w-full h-80" // Default size, can be overridden
              sandbox="allow-scripts allow-same-origin" // Sandboxed for security
              frameBorder="0"
              loading="lazy"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApiEmbedPreview;
