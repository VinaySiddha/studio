
// src/app/actions.ts
'use server';

import { z } from 'zod';
// Genkit specific imports are less relevant now if Flask handles core AI
// import {
//   type ChatTutorInput,
//   type ChatTutorOutput
// } from '@/ai/flows/chat-tutor';
import type { GenerateFaqOutput } from '@/ai/flows/generate-faq';
import type { GenerateTopicsOutput } from '@/ai/flows/generate-topics';
import type { GenerateMindMapOutput } from '@/ai/flows/generate-mind-map';
import type { GeneratePodcastScriptOutput } from '@/ai/flows/generate-podcast-script';

import type { User } from '@/app/page';

const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

// Helper to make authenticated requests to Flask
async function fetchFlaskAPI(endpoint: string, options: RequestInit = {}, authToken?: string | null) {
  const headers: HeadersInit = {
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

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        data = await response.json();
    } else {
        if (!response.ok) {
            data = { error: await response.text() || `Request failed with status ${response.status}` };
        }
    }

    if (!response.ok) {
      console.error(`Flask API Error (${endpoint}, ${response.status}):`, data);
      throw new Error(data?.error || data?.message || `Flask API request failed: ${response.status}`);
    }
    return data;
  } catch (error: any) {
    console.error(`Flask API fetch error to ${endpoint}:`, error);
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
      body: JSON.stringify({ username: identifier, password: password }),
    });

    if (flaskResponse && flaskResponse.token && flaskResponse.username) {
      return {
        user: {
          token: flaskResponse.token,
          username: flaskResponse.username,
          email: flaskResponse.email,
          firstname: flaskResponse.firstname,
          lastname: flaskResponse.lastname,
          gender: flaskResponse.gender,
          mobile: flaskResponse.mobile,
          organization: flaskResponse.organization,
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
  mobile: z.string().optional().or(z.literal('')),
  email: z.string().email("Invalid email address"),
  organization: z.string().optional().or(z.literal('')),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function signupUserAction(formData: FormData): Promise<{ success?: boolean, message?: string, error?: string, user?: User }> {
  const rawFormData = Object.fromEntries(formData.entries());
  const validation = SignupFormSchema.safeParse(rawFormData);

  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.') || 'Error'}: ${e.message}`).join('; ');
    return { error: errorMessages || "Invalid signup data." };
  }

  const { confirmPassword, ...signupDataForFlask } = validation.data;

  try {
    const flaskResponse = await fetchFlaskAPI('/register', {
      method: 'POST',
      body: JSON.stringify(signupDataForFlask),
    });

    if (flaskResponse && (flaskResponse.user_id || flaskResponse.message?.includes("success"))) {
      // Try to get full form data for login, ensuring password is included
      const loginFormData = new FormData();
      loginFormData.append('identifier', validation.data.username);
      loginFormData.append('password', validation.data.password);

      const loginResult = await loginUserAction(loginFormData);
      if (loginResult.user) {
        return { success: true, message: flaskResponse.message || "Signup successful. Logged in.", user: loginResult.user };
      } else {
        return { success: true, message: (flaskResponse.message || "Signup successful.") + " Please log in." };
      }
    } else {
      return { error: flaskResponse.error || "Signup failed: Invalid response from server." };
    }
  } catch (error: any) {
    return { error: error.message || "Signup request failed." };
  }
}

// --- Document and Utility Actions (Calling Flask) ---

export async function listDocumentsAction(userToken: string): Promise<{ uploaded_files: string[], error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/documents', { method: 'GET' }, userToken);
    return { uploaded_files: flaskResponse.uploaded_files || [] };
  } catch (error: any) {
    return { uploaded_files: [], error: error.message || "Failed to list documents." };
  }
}

export async function handleDocumentUploadAction(formData: FormData, userToken: string): Promise<{ message?: string, filename?: string, vector_count?: number, error?: string }> {
  try {
    const response = await fetch(`${FLASK_BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
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

export interface GenerateUtilityFlaskInput {
  documentName: string;
  userToken: string;
}

export async function generateFaq(input: GenerateUtilityFlaskInput): Promise<GenerateFaqOutput & { thinking?: string, raw?: any }> {
   try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'faq'
      }),
    }, input.userToken);
    return {
      faqList: flaskResponse.content || flaskResponse.faqList || "No FAQ content from Flask.",
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generateFaq server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate FAQ via Flask.");
  }
}

export async function generateTopics(input: GenerateUtilityFlaskInput): Promise<GenerateTopicsOutput & { thinking?: string, raw?: any }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'topics'
      }),
    }, input.userToken);
    const topicsContent = Array.isArray(flaskResponse.content) ? flaskResponse.content : (typeof flaskResponse.content === 'string' ? flaskResponse.content.split('\n- ') : []);
    return {
      topics: topicsContent,
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generateTopics server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate topics via Flask.");
  }
}

export async function generateMindMap(input: GenerateUtilityFlaskInput): Promise<GenerateMindMapOutput & { latex_source?: string, thinking?: string, raw?: any }> {
   try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'mindmap'
      }),
    }, input.userToken);
    return {
      mindMap: flaskResponse.content || flaskResponse.mindMap || "No mind map from Flask.",
      latex_source: flaskResponse.latex_source,
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generateMindMap server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate mind map via Flask.");
  }
}

export async function generatePodcastScript(input: GenerateUtilityFlaskInput): Promise<GeneratePodcastScriptOutput & { audio_url?: string, thinking?: string, raw?: any }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'podcast'
      }),
    }, input.userToken);
    return {
      podcastScript: flaskResponse.script || "No podcast script from Flask.",
      audio_url: flaskResponse.audio_url,
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generatePodcastScript server action (Flask call):", error);
    throw new Error(error.message || "Failed to generate podcast script via Flask.");
  }
}

// --- Chat Thread Actions (Calling Flask) ---

export async function createNewChatThreadAction(userToken: string, title: string): Promise<{ thread_id?: string; title?: string; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/chat/thread', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }, userToken);
    return { thread_id: flaskResponse.thread_id, title: flaskResponse.title };
  } catch (error: any) {
    return { error: error.message || "Failed to create new chat thread." };
  }
}

export async function listChatThreadsAction(userToken: string): Promise<{ threads?: any[]; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/threads', { method: 'GET' }, userToken);
    return { threads: flaskResponse || [] }; // Flask returns array directly
  } catch (error: any) {
    return { error: error.message || "Failed to list chat threads." };
  }
}

export async function getThreadHistoryAction(userToken: string, threadId: string): Promise<{ messages?: any[]; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI(`/thread_history?thread_id=${threadId}`, { method: 'GET' }, userToken);
    return { messages: flaskResponse || [] }; // Flask returns array directly
  } catch (error: any) {
    return { error: error.message || "Failed to get thread history." };
  }
}

// Placeholder for chatTutor if it were to be a non-streaming server action
// For streaming, /api/chat/route.ts is used which proxies to Flask
// export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
//   console.warn("Direct chatTutor server action called. Flask is primary for chat.");
//   try {
//     const flaskResponse = await fetchFlaskAPI('/chat', {
//       method: 'POST',
//       body: JSON.stringify(input),
//       // Add auth token if Flask chat endpoint requires it
//     });
//     return flaskResponse; // Ensure Flask response matches ChatTutorOutput structure
//   } catch (error: any) {
//     throw new Error(error.message || "Failed to get response from AI tutor via Flask.");
//   }
// }
