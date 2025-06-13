
// This flow is not used in the simplified version.
// Keeping as a placeholder.
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PlaceholderSchema = z.object({ placeholder: z.string() });
export const generateFaqPlaceholder = ai.defineFlow({ name: 'generateFaqPlaceholder', inputSchema: PlaceholderSchema, outputSchema: PlaceholderSchema }, async () => ({ placeholder: "FAQ generation not active in this version."}));
