
'use server';

import type { User } from '@/app/page'; // Assuming User interface is in page.tsx

// This is a placeholder. In a real app, this would be configured securely.
const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

interface FlaskApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any; // For other potential response fields
}

async function fetchFlaskAPI(endpoint: string, options: RequestInit = {}, authToken?: string): Promise<FlaskApiResponse> {
  const headers = {
    ...options.headers,
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
  };
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${FLASK_BACKEND_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: `HTTP error! Status: ${response.status}. Response not JSON.` , responseText: await response.text() };
      }
      console.error(`Flask API error for ${endpoint} (${response.status}):`, errorData);
      throw new Error(errorData.error || errorData.message || `Request to ${endpoint} failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error(`Flask API fetch error to ${endpoint}:`, error);
    throw new Error(error.message || 'Network error or Flask API is down.');
  }
}

// Authentication Actions
export async function loginUserAction(credentials: any): Promise<User | { error: string }> {
  try {
    const response = await fetchFlaskAPI('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (response.error) throw new Error(response.error);
    return response as User; // Assuming Flask returns the User object compatible structure on login
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function signupUserAction(userData: any): Promise<{ message: string, user_id?: string } | { error: string }> {
  try {
    const response = await fetchFlaskAPI('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (response.error) throw new Error(response.error);
    return response;
  } catch (error: any) {
    return { error: error.message };
  }
}


// Document Actions
export interface DocumentFile {
  name: string;
  securedName: string;
}
interface ListDocumentsResponse extends FlaskApiResponse {
  uploaded_files?: DocumentFile[];
}
export async function listDocumentsAction(userToken: string): Promise<ListDocumentsResponse> {
  try {
    return await fetchFlaskAPI('/documents', {}, userToken);
  } catch (error: any) {
    return { error: error.message };
  }
}

interface UploadResponse extends FlaskApiResponse {
  filename?: string;
  original_filename?: string;
  vector_count?: number;
}
export async function handleDocumentUploadAction(formData: FormData, userToken: string): Promise<UploadResponse> {
  try {
    return await fetchFlaskAPI('/upload', { method: 'POST', body: formData }, userToken);
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteDocumentAction(userToken: string, securedFilename: string): Promise<FlaskApiResponse> {
  try {
    return await fetchFlaskAPI(`/document/${securedFilename}`, { method: 'DELETE' }, userToken);
  } catch (error: any) {
    return { error: error.message };
  }
}

// Utility Actions
interface GenerateUtilityFlaskInput {
  documentName: string; // This should be the securedName
  userToken: string;
}
interface UtilityResponse extends FlaskApiResponse {
  content?: string; // For FAQ, Topics, Mindmap (Mermaid code)
  thinking?: string;
  latex_source?: string; // For mindmap if applicable
  script?: string; // For podcast
  audio_url?: string; // For podcast
  original_filename?: string; // Added for context
  // Specific fields for each utility if they differ:
  faqList?: string; // if generateFaq returns this
  topics?: string[]; // if generateTopics returns this
  mindMap?: string; // if generateMindMap returns this
  podcastScript?: string; // if generatePodcastScript returns this
}

export async function generateFaq(input: GenerateUtilityFlaskInput): Promise<UtilityResponse> {
  try {
    return await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({ filename: input.documentName, analysis_type: 'faq' }),
    }, input.userToken);
  } catch (error: any) { return { error: error.message }; }
}

export async function generateTopics(input: GenerateUtilityFlaskInput): Promise<UtilityResponse> {
   try {
    return await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({ filename: input.documentName, analysis_type: 'topics' }),
    }, input.userToken);
  } catch (error: any) { return { error: error.message }; }
}

export async function generateMindMap(input: GenerateUtilityFlaskInput): Promise<UtilityResponse> {
  try {
    return await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({ filename: input.documentName, analysis_type: 'mindmap' }),
    }, input.userToken);
  } catch (error: any) { return { error: error.message }; }
}

export async function generatePodcastScript(input: GenerateUtilityFlaskInput): Promise<UtilityResponse> {
  try {
    return await fetchFlaskAPI('/analyze', {
      method: 'POST',
      body: JSON.stringify({ filename: input.documentName, analysis_type: 'podcast' }),
    }, input.userToken);
  } catch (error: any) { return { error: error.message }; }
}

// Chat Thread Actions
interface Thread {
  thread_id: string;
  title: string;
  created_at: string;
  last_updated: string;
}
interface ThreadsResponse extends FlaskApiResponse {
  threads?: Thread[];
}
export async function listChatThreadsAction(userToken: string): Promise<ThreadsResponse> {
  try {
    return await fetchFlaskAPI('/threads', {}, userToken);
  } catch (error: any) { return { error: error.message }; }
}

interface HistoryResponse extends FlaskApiResponse {
  messages?: any[]; // Define message structure if known
}
export async function getThreadHistoryAction(userToken: string, threadId: string): Promise<HistoryResponse> {
  try {
    return await fetchFlaskAPI(`/thread_history?thread_id=${threadId}`, {}, userToken);
  } catch (error: any) { return { error: error.message }; }
}

interface NewThreadResponse extends FlaskApiResponse {
  thread_id?: string;
  title?: string;
}
export async function createNewChatThreadAction(userToken: string, title: string = "New Chat"): Promise<NewThreadResponse> {
  try {
    return await fetchFlaskAPI('/chat/thread', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }, userToken);
  } catch (error: any) { return { error: error.message }; }
}

export async function renameChatThreadAction(userToken: string, threadId: string, newTitle: string): Promise<FlaskApiResponse> {
  try {
    return await fetchFlaskAPI(`/chat/thread/${threadId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ new_title: newTitle }),
    }, userToken);
  } catch (error: any) { return { error: error.message }; }
}

export async function deleteChatThreadAction(userToken: string, threadId: string): Promise<FlaskApiResponse> {
  try {
    return await fetchFlaskAPI(`/chat/thread/${threadId}`, { method: 'DELETE' }, userToken);
  } catch (error: any) { return { error: error.message }; }
}

// Transcription Action
interface TranscriptionResponse extends FlaskApiResponse {
  text?: string;
}
export async function transcribeAudioAction(userToken: string, formData: FormData): Promise<TranscriptionResponse> {
  try {
    return await fetchFlaskAPI('/transcribe-audio', {
      method: 'POST',
      body: formData, // FormData will set Content-Type automatically
    }, userToken);
  } catch (error: any) { return { error: error.message }; }
}
