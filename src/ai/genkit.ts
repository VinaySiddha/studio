
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This configuration assumes that the GOOGLE_API_KEY environment variable is set
// where the Next.js server (and thus Genkit) is running.
export const ai = genkit({
  plugins: [
    googleAI({
      // apiKey: process.env.GOOGLE_API_KEY // This is picked up automatically by the plugin if GOOGLE_API_KEY env var is set.
                                           // Explicitly setting it here is also an option if you prefer.
    }),
  ],
  // Default model for Genkit operations, can be overridden in specific calls.
  // Using a Gemini 1.5 Flash model for cost-effectiveness and speed.
  model: 'googleai/gemini-1.5-flash-latest', 
});
