
'use client';
import type { FC } from 'react';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { loginUserAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/app/page';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  identifier: z.string().min(1, "Username or Email is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToSignup: () => void;
}

const LoginForm: FC<LoginFormProps> = ({ onLoginSuccess, onSwitchToSignup }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit: SubmitHandler<LoginFormValues> = async (data) => {
    setIsLoading(true);
    try {
      const result = await loginUserAction(data);
      if (result.error) {
        throw new Error(result.error);
      }
      // Assuming Flask returns token and username on successful login
      // and other details if available, matching the User interface
      const userResponse = result as User; 
      if (!userResponse.token || !userResponse.username) {
          throw new Error("Login response missing token or username.");
      }
      toast({ title: "Login Successful", description: `Welcome back, ${userResponse.username}!` });
      onLoginSuccess(userResponse);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-ai-engineer-dark-bg p-4">
      <Card className="w-full max-w-md glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-ai-engineer-accent-blue">Login</CardTitle>
          <CardDescription className="text-ai-engineer-text-secondary">
            Access your AI Engineering Tutor account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-ai-engineer-text-primary">Username or Email</Label>
              <Input
                id="identifier"
                autoComplete="username"
                className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted"
                placeholder="your.username or email@example.com"
                {...form.register("identifier")}
                disabled={isLoading}
              />
              {form.formState.errors.identifier && (
                <p className="text-xs text-destructive">{form.formState.errors.identifier.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-ai-engineer-text-primary">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="bg-ai-engineer-input-bg text-ai-engineer-text-primary"
                {...form.register("password")}
                disabled={isLoading}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-ai-engineer-accent-blue hover:bg-ai-engineer-accent-blue/90 text-primary-foreground btn-glow-primary-hover text-base" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center">
          <p className="text-sm text-ai-engineer-text-muted">
            Don't have an account?{' '}
            <Button variant="link" className="p-0 h-auto text-ai-engineer-accent-teal hover:text-ai-engineer-accent-teal/80" onClick={onSwitchToSignup} disabled={isLoading}>
              Sign up here
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
