import { config } from 'dotenv';
config(); // Load .env variables for GOOGLE_API_KEY

// Import your Genkit flows here
import '@/ai/flows/contextual-chat'; // Main chat flow for Gemini

// If you add more flows, import them here as well.
// e.g., import '@/ai/flows/another-flow';

// This file is primarily used by 'npm run genkit:dev' or 'npm run genkit:watch'
// to start the Genkit developer UI and make flows available for inspection.
// It doesn't directly run in the Next.js app build but ensures Genkit CLI
// knows about your flows.
