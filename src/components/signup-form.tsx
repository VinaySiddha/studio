
'use client';
import type { FC, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface SignupFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  onShowLogin: () => void;
  error: string | null;
  isLoading: boolean;
}

const SignupForm: FC<SignupFormProps> = ({ onSubmit, onShowLogin, error, isLoading }) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(formData);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <Card className="w-full max-w-lg glass-panel">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary">Create an Account</CardTitle>
          <CardDescription>Fill in the details below to get started.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-firstname">First Name</Label>
                <Input id="signup-firstname" name="firstname" placeholder="John" required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-lastname">Last Name</Label>
                <Input id="signup-lastname" name="lastname" placeholder="Doe" required disabled={isLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-username">Username</Label>
              <Input id="signup-username" name="username" placeholder="johndoe" required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" name="email" type="email" placeholder="john.doe@example.com" required disabled={isLoading} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-gender">Gender</Label>
                 <Select name="gender" disabled={isLoading}>
                  <SelectTrigger id="signup-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-mobile">Mobile (Optional)</Label>
                <Input id="signup-mobile" name="mobile" type="tel" placeholder="+1234567890" disabled={isLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-organization">Organization (Optional)</Label>
              <Input id="signup-organization" name="organization" placeholder="Your Company/School" disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input id="signup-password" name="password" type="password" placeholder="Minimum 8 characters" required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password">Confirm Password</Label>
              <Input id="signup-confirm-password" name="confirmPassword" type="password" placeholder="Re-enter your password" required disabled={isLoading} />
            </div>
            {error && <p className="text-sm text-destructive whitespace-pre-line">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full btn-glow-primary-hover" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign Up
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Button variant="link" type="button" onClick={onShowLogin} className="p-0 h-auto" disabled={isLoading}>
                Log in
              </Button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SignupForm;
