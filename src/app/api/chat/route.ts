// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { contextualChatPrompt, ContextualChatInputSchema } from '@/ai/flows/contextual-chat';
import type { Message } from '@/components/message-item'; // Assuming Message type definition

export const dynamic = 'force-dynamic';

// Schema for the request body to this API route
const ApiRouteInputSchema = z.object({
  query: z.string(),
  documentText: z.string().optional().nullable(), // Text from document mode
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().nullable(),
  // The API key is NOT directly consumed here from client.
  // Genkit's googleAI() plugin uses the server-side GOOGLE_API_KEY environment variable.
});

export async function POST(request: Request) {
  console.log('[API /chat] Received request');
  let requestBody;
  try {
    requestBody = await request.json();
    const validation = ApiRouteInputSchema.safeParse(requestBody);

    if (!validation.success) {
      console.error('[API /chat] Invalid input:', validation.error.format());
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
    }

    const { query, documentText, history } = validation.data;
    console.log(`[API /chat] Processing query: "${query.substring(0, 50)}...", HasDoc: ${!!documentText}, HistoryLen: ${history?.length || 0}`);

    const promptInput: z.infer<typeof ContextualChatInputSchema> = {
      query,
      documentText: documentText || undefined, // Pass undefined if null/empty
      history: history || undefined,
    };
    
    // Use Genkit to generate a streaming response with Gemini
    const { stream, response: genkitResponsePromise } = ai.generateStream({
      prompt: contextualChatPrompt,
      input: promptInput,
      history: history as Message[] || [], // Pass history to Genkit
      config: {
        // You can add model-specific config here if needed, e.g., temperature
      }
    });

    console.log('[API /chat] Gemini stream initiated via Genkit.');

    const clientReadableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const textContent = chunk.text;
            if (textContent) {
              const sseFormattedChunk = `data: ${JSON.stringify({ type: 'chunk', content: textContent })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseFormattedChunk));
            }
          }
          
          // Wait for the full Genkit response to resolve (contains potential structured output or errors)
          const finalGenkitResponse = await genkitResponsePromise;
          const finalOutput = finalGenkitResponse.output(); // This would be structured if prompt had output schema

          console.log('[API /chat] Stream ended. Final Genkit Output:', finalOutput);

          // Send a final message indicating completion, can include structured data if available
          const finalMessage = {
            type: 'final',
            answer: typeof finalOutput === 'string' ? finalOutput : (finalOutput?.answer || ""), 
            // references: finalOutput?.references || [], // If your prompt/flow structures references
            // debugInfo: finalOutput?.debugInfo,
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalMessage)}\n\n`));

        } catch (error: any) {
          console.error('[API /chat] Error streaming from Genkit to client:', error);
          const errorType = error.name || "StreamError";
          const errorMessage = error.message || 'Streaming error from Genkit/Gemini';
          const errorEvent = `data: ${JSON.stringify({ type: 'error', error: `${errorType}: ${errorMessage}` })}\n\n`;
          try {
            controller.enqueue(new TextEncoder().encode(errorEvent));
          } catch (enqueueError) {
            console.error("[API /chat] Error enqueuing error message to stream:", enqueueError);
          }
        } finally {
          try {
            controller.close();
            console.log('[API /chat] Stream controller closed.');
          } catch (closeError) {
             console.error("[API /chat] Error closing stream controller:", closeError);
          }
        }
      }
    });

    return new Response(clientReadableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[API /chat] Outer route error:', error);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ error: 'Invalid JSON in request body.', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'An unexpected error occurred in /api/chat.' }, { status: 500 });
  }
}
