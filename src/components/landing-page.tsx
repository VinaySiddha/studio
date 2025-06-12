
import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, UserPlus } from 'lucide-react';

interface LandingPageProps {
  onShowLogin: () => void;
  onShowSignup: () => void;
}

const LandingPage: FC<LandingPageProps> = ({ onShowLogin, onShowSignup }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md glass-panel">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">Welcome to the AI Tutor!</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your personal assistant for learning and document analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-foreground/80">
            Please log in to access your documents and chat with the AI, or sign up if you're new here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={onShowLogin} className="flex-1 btn-glow-primary-hover" size="lg">
              <Zap className="mr-2 h-5 w-5" /> Login
            </Button>
            <Button onClick={onShowSignup} variant="outline" className="flex-1 btn-glow-primary-hover" size="lg">
              <UserPlus className="mr-2 h-5 w-5" /> Sign Up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandingPage;
