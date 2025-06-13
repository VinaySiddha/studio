'use server';
/**
 * @fileOverview Defines a Genkit flow for contextual chat using Gemini.
 * This flow can operate in a general chat mode or a document-focused mode
 * based on whether documentText is provided.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const ContextualChatInputSchema = z.object({
  query: z.string().describe('The user query.'),
  documentText: z.string().optional().describe('Optional: Text content of a document to provide context for the query.'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('Optional: Previous conversation history.'),
});
export type ContextualChatInput = z.infer<typeof ContextualChatInputSchema>;

// Output schema is primarily for conceptual guidance or non-streaming responses.
// For streaming, the API route will typically handle raw text chunks.
export const ContextualChatOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer.'),
  references: z.array(z.object({
    source: z.string(),
    preview: z.string().optional(),
  })).optional().describe('References used if answering from document context.'),
  debugInfo: z.string().optional().describe('Optional debug information.'),
});
export type ContextualChatOutput = z.infer<typeof ContextualChatOutputSchema>;

const DOCUMENT_CONTEXT_INSTRUCTION = `
If "Document Context" is provided and is not empty, your primary goal is to answer the "User Query" based EXCLUSIVELY on the information within that "Document Context".
- Cite information taken from the document by stating "According to the document..." or similar phrasing.
- If the answer to the "User Query" cannot be found within the "Document Context", you MUST explicitly state: "Based on the provided document, I cannot answer that question." or "The document does not contain information about that."
- Do NOT use your general knowledge or external information when "Document Context" is available and relevant.
- If the query seems unrelated to the document context, you may politely state that and ask if the user wants a general answer instead.`;

const GENERAL_CHAT_INSTRUCTION = `
If "Document Context" is NOT provided or is empty, answer the "User Query" using your general knowledge as an expert AI assistant.
- Provide comprehensive, helpful, and accurate information.
- Be conversational and engaging.`;

export const contextualChatPrompt = ai.definePrompt({
  name: 'contextualChatGeminiPrompt',
  input: { schema: ContextualChatInputSchema },
  // Output schema is not strictly enforced for streaming text, but useful for defining intent.
  // output: { schema: ContextualChatOutputSchema },

  system: `You are a helpful and versatile AI assistant. Your behavior depends on the context provided.

${GENERAL_CHAT_INSTRUCTION}

${DOCUMENT_CONTEXT_INSTRUCTION}

Always structure your answers clearly. Use Markdown for formatting if appropriate (e.g., lists, bolding, code blocks).
Be concise yet informative. If the user asks for a very short answer, provide one.
If the user's query is ambiguous, ask for clarification.
If the user query is inappropriate, harmful, or violates safety guidelines, decline to answer politely.`,

  prompt: `{{#if documentText}}
Document Context:
---
{{{documentText}}}
---
{{/if}}

User Query: {{{query}}}

AI Answer:
`,
});

// Define the Genkit flow
export const contextualChatFlow = ai.defineFlow(
  {
    name: 'contextualChatFlow',
    inputSchema: ContextualChatInputSchema,
    outputSchema: ContextualChatOutputSchema, // For non-streaming or structured output
  },
  async (input) => {
    // For a non-streaming version, you would directly call the prompt and parse.
    // For streaming, this flow might not be directly called by the API route
    // if the route handles ai.generateStream() itself.
    // This flow serves as a definition of the logic.

    const generationResponse = await contextualChatPrompt(input);
    const output = generationResponse.output();

    if (!output) {
      return {
        answer: "Sorry, I couldn't generate a response. The model returned no output.",
      };
    }
    
    // Assuming output is text and we need to package it.
    // If the model directly returns structured output matching ContextualChatOutputSchema, this part changes.
    return {
      answer: typeof output === 'string' ? output : JSON.stringify(output), // crude fallback
      // references: [], // Add reference extraction logic if needed from the text output
    };
  }
);

// Wrapper function for easier invocation (optional if using defineFlow directly)
export async function getContextualChatResponse(input: ContextualChatInput): Promise<ContextualChatOutput> {
  return contextualChatFlow(input);
}

// Clean up old flow files if they are no longer needed
// For example, remove generate-faq.ts, generate-mind-map.ts, etc., if this flow replaces them.
// I will assume for now that this single contextualChatFlow is the primary AI interaction.
// If you want to keep other specific utility flows, they should be updated to use Gemini.
