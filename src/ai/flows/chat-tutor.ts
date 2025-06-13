
// src/ai/flows/chat-tutor.ts

/**
 * @fileOverview Defines the prompt and schemas for the AI Chat Tutor using Gemini.
 * This flow is now primarily used by the Next.js API route `/api/chat` which handles Genkit integration.
 *
 * - prompt - The Genkit prompt object used for generating chat responses.
 * - ChatTutorInputSchema - The Zod schema for the input to the chat tutor.
 * - ChatTutorOutputSchema - The Zod schema for the conceptual output of the chat tutor.
 * - ChatTutorInput - The input type for the chatTutor function.
 * - ChatTutorOutput - The return type for the chatTutor function.
 */

import {ai} from '@/ai/genkit'; // Uses the globally configured ai object
import {z} from 'genkit';

// This placeholder constant must match what the frontend sends for general queries.
const GENERAL_QUERY_PLACEHOLDER = "No document provided for context.";


export const ChatTutorInputSchema = z.object({
  documentContent: z
    .string()
    .optional()
    .describe('The content of the uploaded document, or a placeholder if no document is in context.'),
  question: z.string().describe('The question to ask the AI tutor.'),
  threadId: z.string().optional().nullable().describe('The optional existing chat thread ID.'),
  // No API key here, as it's handled by Genkit's server-side configuration
});
export type ChatTutorInput = z.infer<typeof ChatTutorInputSchema>;

// The output schema for a non-streaming response.
// For streaming, the API route will handle chunks of text.
export const ChatTutorOutputSchema = z.object({
  answer: z.string().describe('The answer from the AI tutor.'),
  references: z.array(z.object({
    source: z.string().describe("Source of the reference, e.g., document name or section."),
    content_preview: z.string().optional().describe("A short preview of the reference content."),
    number: z.union([z.number(), z.string()]).optional().describe("Reference number if applicable."),
  })).optional().describe("List of references used for the answer."),
  thinking: z.string().optional().describe("The reasoning process or steps taken by the AI (optional)."),
  threadId: z.string().optional().describe("The chat thread ID, returned if a new thread was created or to confirm the current one."),
});
export type ChatTutorOutput = z.infer<typeof ChatTutorOutputSchema>;


// This is the core prompt object that will be used by the /api/chat route with ai.generateStream()
export const prompt = ai.definePrompt({
  name: 'geminiChatTutorPrompt',
  input: {schema: ChatTutorInputSchema},
  // Output schema is conceptual for the final structured response; streaming sends text chunks.
  // However, providing an output schema can help guide the model if it supports structured output,
  // even if we primarily use the text part of the stream.
  // output: {schema: ChatTutorOutputSchema}, // Removing this for pure text streaming for simplicity in this step
  
  // System message to guide Gemini
  system: `You are an AI Engineering Tutor. Be helpful, precise, and informative.
Your primary goal is to answer the user's query.
If "Document Content" is provided and is not the placeholder "${GENERAL_QUERY_PLACEHOLDER}", base your answer EXCLUSIVELY and primarily on that document.
    - When using information from the document, clearly state that the information comes from the provided document. You can cite it as "the provided document" or similar.
    - If the answer is not found in the document, explicitly state: "I could not find this information in the uploaded document." Do NOT use general knowledge if a document is provided for context.
If "Document Content" is "${GENERAL_QUERY_PLACEHOLDER}" or seems absent, answer the question using your general knowledge as an expert engineering tutor.
Structure your answers clearly. Use Markdown for formatting if appropriate (e.g., lists, code blocks for technical explanations).
If a thinking process is helpful, you can optionally include it within <thinking>...</thinking> tags before your final answer.`,
  
  // The user's input will be constructed using the fields from ChatTutorInputSchema
  // We combine documentContent and question into a single prompt for the model.
  // Handlebars templating is used by Genkit prompts.
  prompt: `{{#if documentContent}}
{{#if (eq documentContent "${GENERAL_QUERY_PLACEHOLDER}")}}
User Question (General Knowledge):
{{{question}}}
{{else}}
Document Content:
---
{{{documentContent}}}
---

User Question (Based on the document above):
{{{question}}}
{{/if}}
{{else}}
User Question (General Knowledge):
{{{question}}}
{{/if}}

Your Answer:
`,
});

// This non-streaming flow definition might not be directly used if /api/chat fully handles streaming.
// However, it's good practice to keep it as it defines the core logic.
const chatTutorFlow = ai.defineFlow(
  {
    name: 'geminiChatTutorFlow',
    inputSchema: ChatTutorInputSchema,
    outputSchema: ChatTutorOutputSchema, // For non-streaming version
  },
  async (input) => {
    // This uses the regular generation, not streaming.
    const generationResponse = await prompt(input); // This call might need adjustment based on prompt type.
                                                  // If prompt() returns a GenerateResponse, then .output() is needed.
    const output = generationResponse.output();

    if (!output) {
      return {
        answer: "Sorry, I couldn't generate a response due to an unexpected issue.",
        threadId: input.threadId || `simulated-${Date.now()}`
      };
    }
    
    // For a non-streaming flow, we might parse the text to simulate structured output if needed.
    // Or, assume the model directly outputs something matching ChatTutorOutputSchema if `output: {schema: ...}` was used in definePrompt.
    // For simplicity, if output schema is not strictly enforced by Gemini text generation:
    return {
      answer: output.answer || (typeof output === 'string' ? output : "Response format error."), // Gemini might return just text
      references: output.references || [],
      thinking: output.thinking || undefined,
      threadId: input.threadId || output.threadId || `simulated-${Date.now()}`
    };
  }
);

// Exporting the non-streaming wrapper function if needed elsewhere, though /api/chat will be primary.
export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  return chatTutorFlow(input);
}
