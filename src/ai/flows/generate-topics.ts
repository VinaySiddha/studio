

/**
 * @fileOverview Generates the main topics covered in a document.
 *
 * - generateTopics - A function that handles the generation of topics from a document.
 * - GenerateTopicsInput - The input type for the generateTopics function.
 * - GenerateTopicsOutput - The return type for the generateTopics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTopicsInputSchema = z.object({
  documentText: z.string().describe('The text content of the document.'),
});
export type GenerateTopicsInput = z.infer<typeof GenerateTopicsInputSchema>;

const GenerateTopicsOutputSchema = z.object({
  topics: z.array(z.string()).describe('A list of the main topics covered in the document.'),
});
export type GenerateTopicsOutput = z.infer<typeof GenerateTopicsOutputSchema>;

export async function generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
  return generateTopicsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTopicsPrompt',
  input: {schema: GenerateTopicsInputSchema},
  output: {schema: GenerateTopicsOutputSchema},
  prompt: `You are an expert in topic extraction. Please read the following document and identify the main topics covered in it. Return a list of topics.

Document:
{{{documentText}}}`,
});

const generateTopicsFlow = ai.defineFlow(
  {
    name: 'generateTopicsFlow',
    inputSchema: GenerateTopicsInputSchema,
    outputSchema: GenerateTopicsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
