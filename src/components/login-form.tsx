
'use client';
import type { FC, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  onShowSignup: () => void;
  error: string | null;
  isLoading: boolean;
}

const LoginForm: FC<LoginFormProps> = ({ onSubmit, onShowSignup, error, isLoading }) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(formData);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md glass-panel">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary">Login</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Username or Email</Label>
              <Input id="identifier" name="identifier" type="text" placeholder="your_username or user@example.com" required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required disabled={isLoading} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full btn-glow-primary-hover" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Button variant="link" type="button" onClick={onShowSignup} className="p-0 h-auto" disabled={isLoading}>
                Sign up
              </Button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginForm;
