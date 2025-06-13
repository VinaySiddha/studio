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
});
export type GeminiChatInput = z.infer<typeof GeminiChatInputSchema>;

export const GeminiChatOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer.'),
});
export type GeminiChatOutput = z.infer<typeof GeminiChatOutputSchema>;


export const geminiChatPrompt = ai.definePrompt({
  name: 'geminiChatPrompt',
  input: { schema: GeminiChatInputSchema },
  // Output schema is conceptual for a non-streaming response.
  // output: { schema: GeminiChatOutputSchema },

  system: `You are a helpful and versatile AI assistant powered by Gemini.
Provide comprehensive, helpful, and accurate information.
Be conversational and engaging.
Structure your answers clearly. Use Markdown for formatting if appropriate (e.g., lists, bolding, code blocks).
If the user's query is ambiguous, ask for clarification.
If the user query is inappropriate, harmful, or violates safety guidelines, decline to answer politely.`,

  prompt: `User Query: {{{query}}}

AI Answer:
`,
});

// Define the Genkit flow (mainly for conceptual definition if API route handles streaming directly)
export const geminiChatFlow = ai.defineFlow(
  {
    name: 'geminiChatFlow',
    inputSchema: GeminiChatInputSchema,
    outputSchema: GeminiChatOutputSchema, 
  },
  async (input) => {
    const generationResponse = await geminiChatPrompt(input); // This uses the defined prompt
    const outputContent = generationResponse.output();

    if (!outputContent) {
      return {
        answer: "Sorry, I couldn't generate a response. The model returned no output.",
      };
    }
    
    // Assuming output is text or has a text() method
    const answerText = typeof outputContent === 'string' ? outputContent : (outputContent as any).answer || JSON.stringify(outputContent);
    
    return {
      answer: answerText,
    };
  }
);

// Wrapper function for easier invocation (optional)
export async function getGeminiChatResponse(input: GeminiChatInput): Promise<GeminiChatOutput> {
  return geminiChatFlow(input);
}
