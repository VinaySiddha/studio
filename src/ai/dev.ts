// src/ai/dev.ts
// This file is used by 'npm run genkit:dev' or 'npm run genkit:watch'
// For the reverted Flask-based UI, direct Genkit chat flows are not the primary chat mechanism.
// However, if you have other Genkit flows for different AI features (e.g., analysis, summarization directly via Genkit),
// you would import them here.
// For now, if no other Genkit flows are actively used by the frontend, this can be minimal.

import { config } from 'dotenv';
config(); // Load .env variables for GOOGLE_API_KEY if Genkit utilities are used server-side.

// Example: If you had a Genkit flow for summarization you wanted to test in Dev UI:
// import '@/ai/flows/summarize-document-flow'; 

// If chat-tutor.ts was a Genkit flow, it would be imported here too.
// But in the restored UI, chat is proxied to Flask.
// import '@/ai/flows/chat-tutor'; // Assuming this might exist for other purposes or testing

console.log("Genkit Dev UI configured. Ensure GOOGLE_API_KEY is set if using Google AI plugin.");
