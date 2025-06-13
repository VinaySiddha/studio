
// src/ai/flows/chat-tutor.ts

/**
 * @fileOverview A chat tutor AI agent that can answer questions about uploaded documents.
 *
 * - chatTutor - A function that handles the chat tutor process (non-streaming).
 * - prompt - The Genkit prompt object used for generating chat responses (can be used for streaming by an API route).
 * - ChatTutorInputSchema - The Zod schema for the input to the chat tutor.
 * - ChatTutorOutputSchema - The Zod schema for the output of the non-streaming chat tutor.
 * - ChatTutorInput - The input type for the chatTutor function.
 * - ChatTutorOutput - The return type for the chatTutor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const ChatTutorInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the uploaded document.'),
  question: z.string().describe('The question to ask the AI tutor.'),
  // threadId is not directly used by this prompt/flow's current definition
  // but could be added if the prompt were to manage history or context via threadId.
  // For now, context is passed directly via documentContent.
  threadId: z.string().optional().describe('The optional existing chat thread ID.'),
});
export type ChatTutorInput = z.infer<typeof ChatTutorInputSchema>;

export const ChatTutorOutputSchema = z.object({
  answer: z.string().describe('The answer from the AI tutor.'),
  references: z.array(z.object({
    source: z.string().describe("Source of the reference, e.g., document name or section."),
    content_preview: z.string().optional().describe("A short preview of the reference content."),
    number: z.number().optional().describe("Reference number if applicable."),
  })).optional().describe("List of references used for the answer."),
  thinking: z.string().optional().describe("The reasoning process or steps taken by the AI."),
  threadId: z.string().optional().describe("The chat thread ID, returned if a new thread was created or to confirm the current one."),
});
export type ChatTutorOutput = z.infer<typeof ChatTutorOutputSchema>;


// This is the core prompt object that can be used by both streaming and non-streaming logic.
export const prompt = ai.definePrompt({
  name: 'chatTutorPrompt',
  input: {schema: ChatTutorInputSchema},
  output: {schema: ChatTutorOutputSchema}, // Note: For streaming, actual streamed chunks are text. This schema is for the conceptual 'final' output.
  prompt: `You are an AI tutor specializing in answering questions about documents.
Provide clear, concise, and helpful answers.
If the document content is provided, use it as the primary source for your answer.
If the question seems unrelated to the document, you can answer generally but state that it's not from the document.

Document Content:
{{{documentContent}}}

Question:
{{{question}}}

Please provide your answer. If relevant, list any specific parts of the document you referred to as references. You can also optionally include a brief "thinking" process if it helps explain your answer.
Answer:
`,
});

// Non-streaming version of the chat tutor
export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  return chatTutorFlow(input);
}

const chatTutorFlow = ai.defineFlow(
  {
    name: 'chatTutorFlow',
    inputSchema: ChatTutorInputSchema,
    outputSchema: ChatTutorOutputSchema,
  },
  async (input) => {
    // This flow uses the regular generation, not streaming.
    // The streaming logic will be in the API route using `ai.generateStream`.
    const {output} = await prompt(input);
    // Simulate some potential output fields that the prompt might generate based on instructions
    return {
      answer: output?.answer || "Sorry, I couldn't generate a response.",
      references: output?.references || [],
      thinking: output?.thinking || undefined,
      threadId: input.threadId || output?.threadId || `simulated-${Date.now()}` // Simulate threadId persistence
    };
  }
);
