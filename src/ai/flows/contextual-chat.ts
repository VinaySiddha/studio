
'use server';
/**
 * @fileOverview Defines a Genkit flow for simple chat using Gemini.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GeminiChatInputSchema = z.object({
  query: z.string().describe('The user query.'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('Optional: Previous conversation history.'),
  // Document content is removed from here for simplicity; prompt will be generic
});
export type GeminiChatInput = z.infer<typeof GeminiChatInputSchema>;

// Output schema is not strictly needed for streaming text, but good for clarity if flow were non-streaming
export const GeminiChatOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer.'),
  references: z.array(z.object({ // Added for potential future use, even if not populated by current prompt
    source: z.string(),
    content_preview: z.string().optional(),
    number: z.union([z.string(), z.number()]).optional(),
  })).optional(),
  thinking: z.string().optional(),
});
export type GeminiChatOutput = z.infer<typeof GeminiChatOutputSchema>;


export const geminiChatPrompt = ai.definePrompt({
  name: 'geminiChatPrompt', // Simplified name
  input: { schema: GeminiChatInputSchema },
  // No explicit output schema for direct text streaming from model
  system: `You are a helpful and friendly AI assistant. Answer the user's questions clearly and concisely.`,
  prompt: `User Query: {{{query}}}

AI Answer:
`,
});

// This flow is defined but might not be directly called if /api/chat directly uses ai.generateStream with the prompt
export const geminiChatFlow = ai.defineFlow(
  {
    name: 'geminiChatFlow',
    inputSchema: GeminiChatInputSchema,
    outputSchema: GeminiChatOutputSchema, 
  },
  async (input) => {
    // For a non-streaming flow, you'd do:
    // const generationResponse = await geminiChatPrompt(input);
    // const output = generationResponse.output();
    // return { answer: output?.answer || "Sorry, I couldn't generate a response." };

    // However, for streaming, this flow itself isn't directly used by the /api/chat route.
    // The route will use `ai.generateStream({prompt: geminiChatPrompt, input})`
    // This flow is more for testing or non-streaming scenarios.
    const llmResponse = await ai.generate({
        prompt: input.query, // Simplified prompt for this direct generation
        history: input.history,
        model: ai.model('googleai/gemini-1.5-flash-latest') // Explicit model
    });
    
    return { answer: llmResponse.text() };
  }
);

// Export a non-streaming wrapper if needed elsewhere
export async function getGeminiChatResponse(input: GeminiChatInput): Promise<GeminiChatOutput> {
  return geminiChatFlow(input);
}
