
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This configuration assumes that the GOOGLE_API_KEY environment variable is set
// where the Next.js server (and thus Genkit) is running.
export const ai = genkit({
  plugins: [
    googleAI({
      // apiKey: process.env.GOOGLE_API_KEY // This is picked up automatically by the plugin if GOOGLE_API_KEY env var is set.
    }),
  ],
  // Default model for Genkit operations
  model: 'googleai/gemini-1.5-flash-latest', 
  // Enable telemetry and tracing for better observability, especially during development.
  // In production, you might configure a different logger or exporter.
  // telemetry: {
  //   instrumentation: {
  //     llm: true, // Instrument LLM calls
  //     flow: true, // Instrument flows
  //   },
  //   logger: console, // Use console logger for dev
  // },
  // Set a default temperature for generations if desired
  // generationConfig: {
  //   temperature: 0.7,
  // },
});
