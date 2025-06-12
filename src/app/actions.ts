
// src/app/actions.ts
'use server';

import { z } from 'zod';
import type { User } from '@/app/page';

const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

// Helper to make authenticated requests to Flask
async function fetchFlaskAPI(endpoint: string, options: RequestInit = {}, authToken?: string | null) {
  const headers: HeadersInit = {
    // 'Content-Type': 'application/json', // Content-Type might vary (e.g., for FormData)
    ...options.headers,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Only set Content-Type if body is JSON and not FormData
  if (!(options.body instanceof FormData) && options.body && typeof options.body === 'string') {
    try {
      JSON.parse(options.body); // Check if body is valid JSON
      if(!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } catch (e) {
      // Not JSON, don't set Content-Type or it's already set
    }
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
        // If not JSON, attempt to get text, especially for errors
        const textResponse = await response.text();
        if (!response.ok) {
            data = { error: textResponse || `Request failed with status ${response.status}` };
        } else {
            // If it was a successful non-JSON response, this might need specific handling
            // For now, just return the text if it's a success.
            return { successText: textResponse } as any; 
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
      headers: {'Content-Type': 'application/json'}
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
      headers: {'Content-Type': 'application/json'}
    });

    if (flaskResponse && (flaskResponse.user_id || flaskResponse.message?.includes("success"))) {
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

export async function handleDocumentUploadAction(formData: FormData, userToken: string): Promise<{ message?: string, filename?: string, original_filename?: string, vector_count?: number, error?: string }> {
  try {
    // FormData is handled by fetchFlaskAPI correctly
    const flaskResponse = await fetchFlaskAPI('/upload', {
      method: 'POST',
      body: formData,
    }, userToken);
    return { 
      message: flaskResponse.message, 
      filename: flaskResponse.filename, // secured filename
      original_filename: flaskResponse.original_filename, 
      vector_count: flaskResponse.vector_count 
    };
  } catch (error: any) {
    return { error: error.message || "File upload to Flask failed." };
  }
}

export async function deleteDocumentAction(userToken: string, documentName: string): Promise<{ success?: boolean, message?: string, error?: string }> {
  try {
    // Assuming documentName is the filename Flask uses (e.g., the secured UUID one)
    const flaskResponse = await fetchFlaskAPI(`/document/${documentName}`, {
      method: 'DELETE',
    }, userToken);
    // Flask backend should ideally return a success message or status
    return { success: true, message: flaskResponse.message || "Document deleted successfully." };
  } catch (error: any) {
    console.error(`Error deleting document ${documentName} via Flask:`, error);
    return { success: false, error: error.message || "Failed to delete document." };
  }
}


export interface GenerateUtilityFlaskInput {
  documentName: string; // This should be the secured filename from Flask
  userToken: string;
}

export async function generateFaq(input: GenerateUtilityFlaskInput): Promise<{ faqList?: string, content?: string, thinking?: string, raw?: any, error?: string }> {
   try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName, // Pass secured filename
        analysis_type: 'faq'
      }),
      headers: {'Content-Type': 'application/json'}
    }, input.userToken);
    return {
      content: flaskResponse.content || flaskResponse.faqList || "No FAQ content from Flask.",
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generateFaq server action (Flask call):", error);
    return { error: error.message || "Failed to generate FAQ via Flask." };
  }
}

export async function generateTopics(input: GenerateUtilityFlaskInput): Promise<{ topics?: string[], content?: string, thinking?: string, raw?: any, error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'topics'
      }),
      headers: {'Content-Type': 'application/json'}
    }, input.userToken);
    const topicsContent = Array.isArray(flaskResponse.content) ? flaskResponse.content : (typeof flaskResponse.content === 'string' ? flaskResponse.content.split('\n- ') : []);
    return {
      content: flaskResponse.content, // Keep raw content string
      topics: topicsContent,          // Also provide parsed array
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any)
{
    console.error("Error in generateTopics server action (Flask call):", error);
    return { error: error.message || "Failed to generate topics via Flask." };
  }
}

export async function generateMindMap(input: GenerateUtilityFlaskInput): Promise<{ mindMap?: string, content?:string, latex_source?: string, thinking?: string, raw?: any, error?: string }> {
   try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'mindmap'
      }),
      headers: {'Content-Type': 'application/json'}
    }, input.userToken);
    return {
      content: flaskResponse.content || flaskResponse.mindMap || "No mind map from Flask.",
      latex_source: flaskResponse.latex_source,
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generateMindMap server action (Flask call):", error);
    return { error: error.message || "Failed to generate mind map via Flask." };
  }
}

export async function generatePodcastScript(input: GenerateUtilityFlaskInput): Promise<{ podcastScript?: string, script?: string, audio_url?: string, thinking?: string, raw?: any, error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.documentName,
        analysis_type: 'podcast'
      }),
      headers: {'Content-Type': 'application/json'}
    }, input.userToken);
    return {
      script: flaskResponse.script || "No podcast script from Flask.",
      audio_url: flaskResponse.audio_url,
      thinking: flaskResponse.thinking,
      raw: flaskResponse
    };
  } catch (error: any) {
    console.error("Error in generatePodcastScript server action (Flask call):", error);
    return { error: error.message || "Failed to generate podcast script via Flask." };
  }
}

// --- Chat Thread Actions (Calling Flask) ---

export async function createNewChatThreadAction(userToken: string, title: string): Promise<{ thread_id?: string; title?: string; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/chat/thread', {
      method: 'POST',
      body: JSON.stringify({ title }),
      headers: {'Content-Type': 'application/json'}
    }, userToken);
    return { thread_id: flaskResponse.thread_id, title: flaskResponse.title };
  } catch (error: any) {
    return { error: error.message || "Failed to create new chat thread." };
  }
}

export async function listChatThreadsAction(userToken: string): Promise<{ threads?: any[]; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI('/threads', { method: 'GET' }, userToken);
    return { threads: flaskResponse || [] }; 
  } catch (error: any) {
    return { error: error.message || "Failed to list chat threads." };
  }
}

export async function getThreadHistoryAction(userToken: string, threadId: string): Promise<{ messages?: any[]; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI(`/thread_history?thread_id=${threadId}`, { method: 'GET' }, userToken);
    return { messages: flaskResponse || [] }; 
  } catch (error: any) {
    return { error: error.message || "Failed to get thread history." };
  }
}

export async function renameChatThreadAction(userToken: string, threadId: string, newTitle: string): Promise<{ success?: boolean; message?: string; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI(`/chat/thread/${threadId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ new_title: newTitle }),
      headers: { 'Content-Type': 'application/json' },
    }, userToken);
    return { success: true, message: flaskResponse.message || "Thread renamed successfully." };
  } catch (error: any) {
    console.error(`Error renaming thread ${threadId} via Flask:`, error);
    return { success: false, error: error.message || "Failed to rename thread." };
  }
}

export async function deleteChatThreadAction(userToken: string, threadId: string): Promise<{ success?: boolean; message?: string; error?: string }> {
  try {
    const flaskResponse = await fetchFlaskAPI(`/chat/thread/${threadId}`, {
      method: 'DELETE',
    }, userToken);
    return { success: true, message: flaskResponse.message || "Thread deleted successfully." };
  } catch (error: any) {
    console.error(`Error deleting thread ${threadId} via Flask:`, error);
    return { success: false, error: error.message || "Failed to delete thread." };
  }
}

// --- Voice Transcription Action ---
export async function transcribeAudioAction(userToken: string, audioFormData: FormData): Promise<{text?: string, error?: string}> {
  try {
    const flaskResponse = await fetchFlaskAPI('/transcribe-audio', {
      method: 'POST',
      body: audioFormData, // FormData will set its own Content-Type
    }, userToken);
    return { text: flaskResponse.text };
  } catch (error: any) {
    console.error("Error transcribing audio via Flask:", error);
    return { error: error.message || "Failed to transcribe audio." };
  }
}
