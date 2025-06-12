
// src/app/actions.ts
'use server';

import { z } from 'zod';
import {
  chatTutor as chatTutorFlow,
  type ChatTutorInput,
  type ChatTutorOutput
} from '@/ai/flows/chat-tutor';
import {
  generateFaq as generateFaqFlow,
  type GenerateFaqInput,
  type GenerateFaqOutput
} from '@/ai/flows/generate-faq';
import {
  generateTopics as generateTopicsFlow,
  type GenerateTopicsInput,
  type GenerateTopicsOutput
} from '@/ai/flows/generate-topics';
import {
  generateMindMap as generateMindMapFlow,
  type GenerateMindMapInput,
  type GenerateMindMapOutput
} from '@/ai/flows/generate-mind-map';
import {
  generatePodcastScript as generatePodcastScriptFlow,
  type GeneratePodcastScriptInput,
  type GeneratePodcastScriptOutput
} from '@/ai/flows/generate-podcast-script';
import type { User } from '@/app/page'; // Assuming User type is in page.tsx

// --- Authentication Actions ---

// Mock user database for demonstration
const mockUsers: Record<string, Omit<User, 'token'> & { passwordHash: string }> = {
  "testuser": { username: "testuser", passwordHash: "hashedpassword", email: "test@example.com", firstname: "Test", lastname: "User" },
};
const mockTokens: Record<string, string> = {
  "testuser": "fake-auth-token-for-testuser"
};


export async function loginUserAction(formData: FormData): Promise<{ user?: User, error?: string }> {
  const identifier = formData.get('identifier') as string;
  const password = formData.get('password') as string;

  // Simulate backend call & validation
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  const userEntry = Object.values(mockUsers).find(u => u.username === identifier || u.email === identifier);

  if (userEntry && password === "password") { // Simplified password check for mock
    const token = mockTokens[userEntry.username] || `fake-token-${Date.now()}`;
    mockTokens[userEntry.username] = token; // Store/update token
    return {
      user: {
        username: userEntry.username,
        token: token,
        firstname: userEntry.firstname,
        lastname: userEntry.lastname,
        email: userEntry.email,
      }
    };
  } else {
    return { error: "Invalid username/email or password." };
  }
}

const SignupFormSchema = z.object({
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  gender: z.string().optional(), // Or z.enum(["male", "female", "other"]) if you have fixed values
  mobile: z.string().optional(),
  email: z.string().email("Invalid email address"),
  organization: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});


export async function signupUserAction(formData: FormData): Promise<{ user?: User, error?: string }> {
  const rawFormData = Object.fromEntries(formData.entries());
  const validation = SignupFormSchema.safeParse(rawFormData);

  if (!validation.success) {
    // Concatenate all error messages
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.') || 'Error'}: ${e.message}`).join('; ');
    return { error: errorMessages || "Invalid signup data." };
  }

  const { firstname, lastname, username, email, password, gender, mobile, organization } = validation.data;

  // Simulate backend call & validation
  await new Promise(resolve => setTimeout(resolve, 500));

  if (mockUsers[username]) {
    return { error: "Username already exists." };
  }
  if (Object.values(mockUsers).some(u => u.email === email)) {
    return { error: "Email already registered." };
  }

  const newUser: Omit<User, 'token'> & { passwordHash: string } = {
    username,
    passwordHash: `hashed-${password}`, // Simulate hashing
    email,
    firstname,
    lastname,
    gender,
    mobile,
    organization,
  };
  mockUsers[username] = newUser;
  const token = `fake-token-${Date.now()}`;
  mockTokens[username] = token;

  return {
    user: {
      username,
      token,
      firstname,
      lastname,
      email,
      gender,
      mobile,
      organization,
    }
  };
}


// --- Existing AI Actions ---
export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  try {
    return await chatTutorFlow(input);
  } catch (error) {
    console.error("Error in chatTutor server action:", error);
    throw new Error("Failed to get response from AI tutor.");
  }
}

export async function generateFaq(input: GenerateFaqInput): Promise<GenerateFaqOutput> {
   try {
    return await generateFaqFlow(input);
  } catch (error) {
    console.error("Error in generateFaq server action:", error);
    throw new Error("Failed to generate FAQ.");
  }
}

export async function generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
  try {
    return await generateTopicsFlow(input);
  } catch (error) {
    console.error("Error in generateTopics server action:", error);
    throw new Error("Failed to generate topics.");
  }
}

export async function generateMindMap(input: GenerateMindMapInput): Promise<GenerateMindMapOutput> {
   try {
    return await generateMindMapFlow(input);
  } catch (error) {
    console.error("Error in generateMindMap server action:", error);
    throw new Error("Failed to generate mind map.");
  }
}

export async function generatePodcastScript(input: GeneratePodcastScriptInput): Promise<GeneratePodcastScriptOutput> {
  try {
    return await generatePodcastScriptFlow(input);
  } catch (error) {
    console.error("Error in generatePodcastScript server action:", error);
    throw new Error("Failed to generate podcast script.");
  }
}

// Schema for the output of the external data fetch
const ExternalDataSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});
export type ExternalData = z.infer<typeof ExternalDataSchema>;

/**
 * Fetches data from an external API.
 * This is an example of how to connect to your own backend.
 * @param id - The ID of the resource to fetch (e.g., a todo item ID).
 * @returns A promise that resolves to the fetched and validated data.
 */
export async function fetchExternalData(id: number): Promise<ExternalData> {
  try {
    // Replace this URL with your actual backend API endpoint
    const response = await fetch(`http://localhost:5000/todos/${id}`);
    
    if (!response.ok) {
      // You might want to handle different statuses differently
      throw new Error(`API call failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate the structure of the data received from the API
    const validatedData = ExternalDataSchema.parse(data);
    
    return validatedData;
  } catch (error) {
    console.error("Error in fetchExternalData server action:", error);
    if (error instanceof z.ZodError) {
      // This means the data from the API didn't match the expected schema
      throw new Error(`Data validation failed: ${error.message}`);
    }
    // For other errors (network issues, API errors handled above, etc.)
    throw new Error("Failed to fetch external data. Please check the console for more details.");
  }
}
