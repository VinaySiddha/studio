
// This flow is not used in the simplified version.
// Keeping as a placeholder.
import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const PlaceholderSchema = z.object({ placeholder: z.string() });
export const generatePodcastScriptPlaceholder = ai.defineFlow({ name: 'generatePodcastScriptPlaceholder', inputSchema: PlaceholderSchema, outputSchema: PlaceholderSchema }, async () => ({ placeholder: "Podcast script generation not active in this version."}));
