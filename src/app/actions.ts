
// src/app/actions.ts
'use server';

import { z } from 'zod';
import {
  // chatTutor as chatTutorFlow, // Will be called via Flask or Next.js API route
  type ChatTutorInput, // Keep type for potential direct use or API route
  type ChatTutorOutput
} from '@/ai/flows/chat-tutor';
// Types for other flows might be needed if Flask responses match their structure
// For now, direct Genkit flow calls from these actions will be replaced by Flask calls.
import type { GenerateFaqInput as GenkitGenerateFaqInput, GenerateFaqOutput } from '@/ai/flows/generate-faq';
import type { GenerateTopicsInput as GenkitGenerateTopicsInput, GenerateTopicsOutput } from '@/ai/flows/generate-topics';
import type { GenerateMindMapInput as GenkitGenerateMindMapInput, GenerateMindMapOutput } from '@/ai/flows/generate-mind-map';
import type { GeneratePodcastScriptInput as GenkitGeneratePodcastScriptInput, GeneratePodcastScriptOutput } from '@/ai/flows/generate-podcast-script';

import type { User } from '@/app/page';

const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

// Helper to make authenticated requests to Flask, if needed for some actions
async function fetchFlaskAPI(endpoint: string, options: RequestInit = {}, authToken?: string | null) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${FLASK_BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Attempt to parse JSON, but handle cases where it might not be (e.g. 204 No Content)
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        data = await response.json();
    } else {
        // If not JSON, maybe text or empty. For now, assume text for errors.
        // Or, if response.ok and no content, data can be undefined.
        if (!response.ok) {
            data = { error: await response.text() || `Request failed with status ${response.status}` };
        }
    }


    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Flask API request failed: ${response.status}`);
    }
    return data;
  } catch (error: any) {
    console.error(`Flask API fetch error to ${endpoint}:`, error);
    // Rethrow a consistent error structure or message
    throw new Error(error.message || 'Network error or Flask API is down.');
  }
}


// --- Authentication Actions ---
export async function loginUserAction(formData: FormData): Promise<{ user?: User, error?: string }> {
  const identifier = formData.get('identifier') as string;
  const password = formData.get('password') as string;

  try {
    const flaskResponse = await fetchFlaskAPI('/login', {
      method: 'POST',
      body: JSON.stringify({ username: identifier, password: password }), // Flask expects 'username'
    });

    // Assuming Flask returns { token: string, username: string, email?: string, firstname?: string, lastname?: string ... }
    // Adjust according to your Flask response structure
    if (flaskResponse && flaskResponse.token && flaskResponse.username) {
      return {
        user: {
          token: flaskResponse.token,
          username: flaskResponse.username,
          email: flaskResponse.email,
          firstname: flaskResponse.firstname,
          lastname: flaskResponse.lastname,
          // Add other fields if Flask provides them
        }
      };
    } else {
      return { error: flaskResponse.error || "Login failed: Invalid response from server." };
    }
  } catch (error: any) {
    return { error: error.message || "Login request failed." };
  }
}

const SignupFormSchema = z.object({
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  gender: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email("Invalid email address"),
  organization: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string() // confirmPassword is not sent to Flask, validated here
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});


export async function signupUserAction(formData: FormData): Promise<{ success?: boolean, message?: string, error?: string, user?: User /* if auto-login occurs */ }> {
  const rawFormData = Object.fromEntries(formData.entries());
  const validation = SignupFormSchema.safeParse(rawFormData);

  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.') || 'Error'}: ${e.message}`).join('; ');
    return { error: errorMessages || "Invalid signup data." };
  }

  // Exclude confirmPassword before sending to Flask
  const { confirmPassword, ...signupDataForFlask } = validation.data;

  try {
    // Call Flask's /register endpoint
    const flaskResponse = await fetchFlaskAPI('/register', {
      method: 'POST',
      body: JSON.stringify(signupDataForFlask),
    });

    if (flaskResponse && (flaskResponse.success || flaskResponse.message)) {
      // Attempt auto-login after successful signup
      // This assumes your Flask signup doesn't auto-return a token, and script.js did a separate login
      const loginResult = await loginUserAction(formData); // Use original formData which includes password
      if (loginResult.user) {
        return { success: true, message: flaskResponse.message || "Signup successful. Logged in.", user: loginResult.user };
      } else {
        // Signup was ok, but auto-login failed. User needs to login manually.
        return { success: true, message: (flaskResponse.message || "Signup successful.") + " Please log in." };
      }
    } else {
      return { error: flaskResponse.error || "Signup failed: Invalid response from server." };
    }
  } catch (error: any) {
    return { error: error.message || "Signup request failed." };
  }
}


// --- AI Utility Actions ---
// Updated to take documentName (filename) instead of full content
export interface GenerateFaqFlaskInput {
  documentName: string; // Or documentId, matching what Flask expects
}

export async function generateFaq(input: GenerateFaqFlaskInput): Promise<GenerateFaqOutput> {
   try {
    // Call Flask's /analyze endpoint
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName, // script.js used 'filename'
        analysis_type: 'faq'
      }),
      // TODO: Add auth token if /analyze endpoint in Flask requires it
      // headers: { 'Authorization': `Bearer ${userToken}` } // Need to get token
    });

    // Assuming Flask returns a structure compatible with GenerateFaqOutput
    // e.g., { faqList: "...", thinking: "..." }
    // Adjust if Flask response is different
    return {
      faqList: flaskResponse.content || flaskResponse.faqList || "No FAQ content from Flask.",
      // thinking: flaskResponse.thinking // if Flask provides it
    };
  } catch (error: any) {
    console.error("Error in generateFaq server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate FAQ via Flask.");
  }
}

// TODO: Update other AI utility actions (generateTopics, generateMindMap, generatePodcastScript)
// to call Flask's /analyze endpoint similarly, passing the correct analysis_type
// and expecting the appropriate response structure.

// Example for generateTopics (adapt input/output as needed)
export interface GenerateTopicsFlaskInput {
  documentName: string;
}
export async function generateTopics(input: GenerateTopicsFlaskInput): Promise<GenerateTopicsOutput> {
  try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'topics'
      }),
      // headers: { 'Authorization': `Bearer ${userToken}` }
    });
    return {
      topics: flaskResponse.content || flaskResponse.topics || [],
      // thinking: flaskResponse.thinking
    };
  } catch (error: any) {
    console.error("Error in generateTopics server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate topics via Flask.");
  }
}

export interface GenerateMindMapFlaskInput {
  documentName: string;
}
export async function generateMindMap(input: GenerateMindMapFlaskInput): Promise<GenerateMindMapOutput> {
   try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'mindmap'
      }),
      // headers: { 'Authorization': `Bearer ${userToken}` }
    });
    return {
      mindMap: flaskResponse.content || flaskResponse.mindMap || "No mind map from Flask.",
      // latex_source: flaskResponse.latex_source, // if Flask provides it
      // thinking: flaskResponse.thinking
    };
  } catch (error: any)
{
    console.error("Error in generateMindMap server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate mind map via Flask.");
  }
}

export interface GeneratePodcastScriptFlaskInput {
  documentName: string;
}
export async function generatePodcastScript(input: GeneratePodcastScriptFlaskInput): Promise<GeneratePodcastScriptOutput> {
  try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'podcast'
      }),
      // headers: { 'Authorization': `Bearer ${userToken}` }
    });
    // Assuming Flask returns { script: "...", audio_url: "...", thinking: "..." }
    return {
      podcastScript: flaskResponse.script || "No podcast script from Flask.",
      // audio_url: flaskResponse.audio_url, // If Flask generates and provides URL
      // thinking: flaskResponse.thinking
    };
  } catch (error: any) {
    console.error("Error in generatePodcastScript server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate podcast script via Flask.");
  }
}

// --- Chat Tutor ---
// This action might remain for non-streaming if Flask doesn't offer streaming,
// or be replaced by the /api/chat route calling Flask.
// For now, the /api/chat/route.ts handles streaming via Genkit.
// If Flask has a /chat endpoint, /api/chat/route.ts should proxy to it.
export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  // Option 1: Keep using Genkit directly (as /api/chat/route.ts does for streaming)
  // This would mean Next.js handles the AI chat part.
  // Option 2: Call Flask's chat endpoint.
  // const flaskResponse = await fetchFlaskAPI('/chat', { method: 'POST', body: JSON.stringify(input) });
  // return flaskResponse; // adapt to ChatTutorOutput

  // For now, let's assume /api/chat/route.ts is the primary chat interface.
  // This function might be deprecated or adapted if Flask handles all chat.
  console.warn("chatTutor server action called directly. Consider using /api/chat for streaming or ensure Flask handles this.");
  try {
    // This is a placeholder if we need a non-streaming Genkit call.
    // const { output } = await chatTutorFlow(input); // Assuming chatTutorFlow is defined
    // return output!;
    throw new Error("Non-streaming chatTutor direct call not fully implemented with Flask integration strategy.");
  } catch (error) {
    console.error("Error in direct chatTutor server action:", error);
    throw new Error("Failed to get response from AI tutor (direct call).");
  }
}


// --- Document Upload & Listing (Placeholder actions, Flask will handle) ---
// These would be called from components to interact with Flask document endpoints

export async function listDocumentsAction(userToken: string): Promise<{ uploaded_files: string[], error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/documents', { method: 'GET' }, userToken);
    return { uploaded_files: flaskResponse.uploaded_files || [] };
  } catch (error: any) {
    return { uploaded_files: [], error: error.message || "Failed to list documents." };
  }
}

// The actual upload will likely happen client-side directly to Flask,
// or via a Next.js API route that streams the file to Flask if direct client-side upload is problematic (e.g. CORS).
// A server action like this might just confirm/finalize an upload.
export async function handleDocumentUploadAction(formData: FormData, userToken: string): Promise<{ message?: string, filename?: string, error?: string }> {
  // This action would call Flask's /upload endpoint
  // For FormData, fetch doesn't need Content-Type explicitly set usually.
  const flaskBackendUrl = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';
  try {
    const response = await fetch(`${flaskBackendUrl}/upload`, {
      method: 'POST',
      body: formData,
      headers: { // No 'Content-Type': 'application/json' for FormData
        'Authorization': `Bearer ${userToken}`,
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Upload failed: ${response.status}`);
    }
    return { message: data.message, filename: data.original_filename || data.filename, vector_count: data.vector_count };
  } catch (error: any) {
    return { error: error.message || "File upload to Flask failed." };
  }
}
// External data fetch - can be kept if needed for other purposes or removed if not used.
// For now, it's not directly related to the Flask app's core tutor functions.
const ExternalDataSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});
export type ExternalData = z.infer<typeof ExternalDataSchema>;

export async function fetchExternalData(id: number): Promise<ExternalData> {
  try {
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`); // Example external API
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const data = await response.json();
    const validatedData = ExternalDataSchema.parse(data);
    return validatedData;
  } catch (error: any) {
    console.error("Error in fetchExternalData server action:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`Data validation failed: ${error.message}`);
    }
    throw new Error("Failed to fetch external data.");
  }
}
