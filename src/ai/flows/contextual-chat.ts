// This Genkit flow for direct Gemini chat from Next.js is no longer
// the primary chat mechanism for the UI, as chat is now proxied to Flask.
// Keeping the file for reference or if Genkit is used for other features.
// It won't be directly called by the main ChatTutorSection component anymore.

'use server';
/**
 * @fileOverview Defines a Genkit flow for simple chat using Gemini.
 * THIS FLOW IS NOT USED BY THE MAIN UI CHAT WHICH NOW GOES TO FLASK.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GeminiChatInputSchema = z.object({
  query: z.string().describe('The user query.'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('Optional: Previous conversation history.'),
  documentContent: z.string().optional().describe("Optional content from a document to provide context.")
});
export type GeminiChatInput = z.infer<typeof GeminiChatInputSchema>;

export const GeminiChatOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer.'),
});
export type GeminiChatOutput = z.infer<typeof GeminiChatOutputSchema>;


export const geminiChatPrompt = ai.definePrompt({
  name: 'standaloneGeminiChatPrompt', // Renamed to avoid confusion
  input: { schema: GeminiChatInputSchema },
  system: `You are a helpful AI assistant. 
  {{#if documentContent}}
  Base your answer primarily on the following document content:
  --- DOCUMENT START ---
  {{{documentContent}}}
  --- DOCUMENT END ---
  If the question cannot be answered from the document, say so.
  {{else}}
  Answer the user's question comprehensively.
  {{/if}}`,
  prompt: `User Query: {{{query}}}

AI Answer:
`,
});

export const geminiChatFlow = ai.defineFlow(
  {
    name: 'standaloneGeminiChatFlow',
    inputSchema: GeminiChatInputSchema,
    outputSchema: GeminiChatOutputSchema, 
  },
  async (input) => {
    const generationResponse = await geminiChatPrompt(input);
    const outputContent = generationResponse.output();
    const answerText = typeof outputContent === 'string' ? outputContent : (outputContent as any)?.answer || JSON.stringify(outputContent);
    return { answer: answerText || "Sorry, I couldn't generate a response." };
  }
);

export async function getStandaloneGeminiChatResponse(input: GeminiChatInput): Promise<GeminiChatOutput> {
  return geminiChatFlow(input);
}
