import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// This configuration relies on the GOOGLE_API_KEY environment variable
// being set in the server environment where Next.js (and thus Genkit) is running.
export const ai = genkit({
  plugins: [
    googleAI({
      // The Google AI plugin will automatically attempt to use GOOGLE_API_KEY
      // from process.env if no apiKey is explicitly provided here.
    }),
  ],
  // Default model for Genkit operations.
  // Using Gemini 1.5 Flash for a balance of capability and cost-effectiveness.
  model: 'googleai/gemini-1.5-flash-latest', 
  telemetry: {
    instrumentor: 'openinference',
    logger: 'firebase', // Example, requires firebase plugin if actually logging to Firebase
  },
  enableTracing: process.env.NODE_ENV === 'development',
});
