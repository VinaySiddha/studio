
// src/ai/dev.ts
// This file is used by 'npm run genkit:dev' or 'npm run genkit:watch'
import { config } from 'dotenv';
config(); // Load .env variables for GOOGLE_API_KEY if Genkit utilities are used server-side.

import '@/ai/flows/contextual-chat'; // Import your simplified chat flow

console.log("Genkit Dev UI configured. Ensure GOOGLE_API_KEY is set for Gemini.");
// Add any other flows you want to test in the Genkit Developer UI here.
