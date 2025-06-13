
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Info, AlertTriangle } from 'lucide-react';

const ApiKeyManager: FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedApiKey = localStorage.getItem('userGoogleApiKey');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setIsKeySet(true);
    }
  }, []);

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(event.target.value);
  };

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('userGoogleApiKey', apiKey.trim());
      setIsKeySet(true);
      toast({
        title: "API Key Noted",
        description: "Your API key has been noted for this session. Ensure the GOOGLE_API_KEY environment variable is set on the server for Genkit to use Gemini.",
        duration: 7000,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Invalid API Key",
        description: "Please enter a valid API key.",
      });
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('userGoogleApiKey');
    setApiKey('');
    setIsKeySet(false);
    toast({
      title: "API Key Cleared",
      description: "The noted API key has been cleared from this session's storage.",
    });
  };

  return (
    <Card className="glass-panel rounded-lg shadow-xl mb-8">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <KeyRound className="mr-2 h-6 w-6 text-primary" />
          Google API Key for Gemini
        </CardTitle>
        <CardDescription>
          To use Gemini for chat, ensure your Google API Key is configured.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-md bg-primary/10 border border-primary/30 text-primary-foreground/80 text-sm flex items-start gap-2">
          <Info size={20} className="shrink-0 mt-0.5 text-primary"/>
          <div>
            <strong>Important:</strong> For the application to use Gemini, the 
            <code className="bg-muted/50 text-foreground px-1 py-0.5 rounded mx-1">GOOGLE_API_KEY</code> environment variable must be set when running the Next.js server. 
            This input field is for your reference and to confirm you are aware of this requirement.
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="api-key-input">Your Google API Key:</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="api-key-input"
              type="password"
              placeholder={isKeySet ? "API Key is set (stored locally)" : "Enter your Google API Key"}
              value={apiKey}
              onChange={handleApiKeyChange}
              className="flex-grow"
            />
            {isKeySet ? (
              <Button variant="outline" onClick={handleClearApiKey} className="btn-glow-primary-hover">
                Clear
              </Button>
            ) : (
              <Button onClick={handleSetApiKey} className="btn-glow-primary-hover">
                Set Key
              </Button>
            )}
          </div>
          {isKeySet && (
             <p className="text-xs text-green-400">An API key has been noted for this browser session. The application will attempt to use the server-configured key.</p>
          )}
        </div>
         <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive-foreground/80 text-sm flex items-start gap-2">
            <AlertTriangle size={20} className="shrink-0 mt-0.5 text-destructive"/>
             <p>
            This application uses Genkit with the Google AI plugin. The plugin primarily relies on an environment variable (<code className="bg-muted/50 text-foreground px-1 py-0.5 rounded mx-1">GOOGLE_API_KEY</code>) set on the server where the Next.js application is running.
            While this UI allows you to "set" a key (which is stored in your browser's local storage), it does not dynamically pass this key to each backend request for Genkit to use.
            <strong>For Genkit to function correctly with Gemini, the environment variable on the server is essential.</strong>
            </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiKeyManager;
