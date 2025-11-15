// src/components/CopyCodeButton.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Clipboard, Check } from 'lucide-react';

interface CopyCodeButtonProps {
  codeToCopy: string;
  className?: string;
}

const CopyCodeButton: React.FC<CopyCodeButtonProps> = ({
  codeToCopy,
  className = '',
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setIsCopied(true);
      toast({
        title: 'Copied',
        description: 'Code snippet copied to clipboard.',
      });
      setTimeout(() => setIsCopied(false), 2000); // Reset icon after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        title: 'Error',
        description: 'Failed to copy code.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 ${className}`}
      onClick={handleCopy}
    >
      {isCopied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Clipboard className="h-4 w-4" />
      )}
      <span className="sr-only">Copy code</span>
    </Button>
  );
};

export default CopyCodeButton;
