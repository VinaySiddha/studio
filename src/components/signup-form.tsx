
'use client';
import type { FC } from 'react';
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { signupUserAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/app/page'; // To use for onSignupSuccess if auto-logging in
import { Loader2 } from 'lucide-react';

const signupSchema = z.object({
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  gender: z.string().optional(),
  mobile: z.string().optional().refine(val => !val || /^\d{10,15}$/.test(val), { message: "Invalid mobile number (10-15 digits)" }),
  organization: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

interface SignupFormProps {
  onSignupSuccess: (user: User) => void; // Expect User object for auto-login
  onSwitchToLogin: () => void;
}

const SignupForm: FC<SignupFormProps> = ({ onSignupSuccess, onSwitchToLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstname: '', lastname: '', username: '', email: '', password: '', confirmPassword: '',
      gender: '', mobile: '', organization: '',
    },
  });

  const onSubmit: SubmitHandler<SignupFormValues> = async (data) => {
    setIsLoading(true);
    const { confirmPassword, ...signupData } = data; // Exclude confirmPassword
    try {
      const result = await signupUserAction(signupData);
      if (result.error) {
        throw new Error(result.error);
      }
      toast({ title: "Signup Successful", description: result.message || "Please login with your new account." });
      // Attempt auto-login or switch to login view
      // For simplicity, we'll switch to login. Auto-login would require another call.
      onSwitchToLogin();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Signup Failed", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-ai-engineer-dark-bg p-4">
      <Card className="w-full max-w-lg glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-ai-engineer-accent-teal">Create Account</CardTitle>
          <CardDescription className="text-ai-engineer-text-secondary">
            Join the AI Engineering Tutor platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstname" className="text-ai-engineer-text-primary">First Name</Label>
                <Input id="firstname" {...form.register("firstname")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" />
                {form.formState.errors.firstname && <p className="text-xs text-destructive">{form.formState.errors.firstname.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastname" className="text-ai-engineer-text-primary">Last Name</Label>
                <Input id="lastname" {...form.register("lastname")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" />
                {form.formState.errors.lastname && <p className="text-xs text-destructive">{form.formState.errors.lastname.message}</p>}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-ai-engineer-text-primary">Username</Label>
              <Input id="username" {...form.register("username")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" />
              {form.formState.errors.username && <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-ai-engineer-text-primary">Email</Label>
              <Input id="email" type="email" {...form.register("email")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-ai-engineer-text-primary">Gender (Optional)</Label>
                     <Controller
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                            <SelectTrigger className="w-full bg-ai-engineer-input-bg text-ai-engineer-text-primary">
                                <SelectValue placeholder="Select gender..." />
                            </SelectTrigger>
                            <SelectContent className="!bg-ai-engineer-card-bg border-ai-engineer-border text-ai-engineer-text-primary">
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                        </Select>
                        )}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="mobile" className="text-ai-engineer-text-primary">Mobile (Optional)</Label>
                    <Input id="mobile" type="tel" {...form.register("mobile")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" />
                    {form.formState.errors.mobile && <p className="text-xs text-destructive">{form.formState.errors.mobile.message}</p>}
                </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="organization" className="text-ai-engineer-text-primary">Organization (Optional)</Label>
              <Input id="organization" {...form.register("organization")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-ai-engineer-text-primary">Password</Label>
              <Input id="password" type="password" {...form.register("password")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary" />
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-ai-engineer-text-primary">Confirm Password</Label>
              <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} disabled={isLoading} className="bg-ai-engineer-input-bg text-ai-engineer-text-primary" />
              {form.formState.errors.confirmPassword && <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="w-full bg-ai-engineer-accent-teal hover:bg-ai-engineer-accent-teal/90 text-primary-foreground btn-glow-accent-hover text-base" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center">
          <p className="text-sm text-ai-engineer-text-muted">
            Already have an account?{' '}
            <Button variant="link" className="p-0 h-auto text-ai-engineer-accent-blue hover:text-ai-engineer-accent-blue/80" onClick={onSwitchToLogin} disabled={isLoading}>
              Login here
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignupForm;

