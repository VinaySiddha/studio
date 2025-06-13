import { config } from 'dotenv';
config(); // Load .env variables for GOOGLE_API_KEY

// Import your Genkit flows here
import '@/ai/flows/contextual-chat'; // Updated to simple gemini chat flow (filename remains contextual-chat for now)

// This file is primarily used by 'npm run genkit:dev' or 'npm run genkit:watch'
// to start the Genkit developer UI and make flows available for inspection.
