
// This specific flow name was associated with the Flask proxy and document-specific utilities.
// The simplified Genkit chat uses ai/flows/contextual-chat.ts (or a renamed version like gemini-chat-flow.ts)
// Keeping this as a placeholder to signify its removal from active use in this simplified state.
import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const PlaceholderSchema = z.object({ placeholder: z.string() });
export const chatTutorFlowPlaceholder = ai.defineFlow({ name: 'chatTutorFlowPlaceholder', inputSchema: PlaceholderSchema, outputSchema: PlaceholderSchema }, async () => ({ placeholder: "Legacy chat tutor flow not active."}));
