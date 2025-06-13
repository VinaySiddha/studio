
import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { geminiChatPrompt, GeminiChatInputSchema } from '@/ai/flows/contextual-chat'; // Using the simplified flow
import { z } from 'zod';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

// Define the input schema for this API route
const ApiRouteInputSchema = z.object({
  query: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional(),
  // documentContent and threadId removed as they are not used in the simplified flow
});

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const validation = ApiRouteInputSchema.safeParse(reqBody);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
    }

    const { query, history } = validation.data;

    const genkitInput = { query, history: history || [] };

    // Use ai.generateStream with the defined prompt
    const { stream, response } = ai.generateStream({
      prompt: geminiChatPrompt, // Use the imported prompt object
      input: genkitInput,
      // You can specify a model here if you want to override the default in genkit.ts
      // model: ai.model('googleai/gemini-1.5-flash-latest'), 
      config: {
        // Add any specific Genkit config here, e.g., safetySettings if needed
      },
    });
    
    // Create a new ReadableStream to forward the Genkit stream
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.text();
            if (content) {
              controller.enqueue(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
            }
          }
          // After all chunks, wait for the full response to potentially get structured output
          const finalOutput = await response;
          const fullAnswer = finalOutput.text(); // or finalOutput.output() if schema was used in prompt
          
          controller.enqueue(`data: ${JSON.stringify({ type: 'final', answer: fullAnswer, references: finalOutput.output()?.references, thinking: finalOutput.output()?.thinking })}\n\n`);
          controller.close();
        } catch (err: any) {
          console.error('Streaming error:', err);
          controller.enqueue(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Error streaming response' })}\n\n`);
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json({ error: 'Failed to process chat request', details: error.message }, { status: 500 });
  }
}
