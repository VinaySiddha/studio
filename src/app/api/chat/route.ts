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
  console.log('[Next API /chat - Genkit/Gemini] Received request');
  let requestBody;
  try {
    const body = await request.json();
    const validation = ChatApiInputSchema.safeParse(body);

    if (!validation.success) {
      console.error('[Next API /chat - Genkit/Gemini] Invalid input:', validation.error.format());
      return NextResponse.json({error: 'Invalid input', details: validation.error.format()}, {status: 400});
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

    console.log('[Next API /chat - Genkit/Gemini] Gemini stream initiated.');

    // Create a new ReadableStream to send back to the client
    const clientReadableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const textContent = chunk.text;
            if (textContent) {
              // SSE format: data: {"type": "chunk", "content": "..."}\n\n
              const sseFormattedChunk = `data: ${JSON.stringify({type: 'chunk', content: textContent})}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseFormattedChunk));
            }
          }
          
          // Wait for the full Genkit response to resolve (contains potential structured output or errors)
          const finalGenkitResponse = await genkitResponsePromise;
          const finalOutput = finalGenkitResponse.output(); // This would be structured if prompt had output schema

          console.log('[Next API /chat - Genkit/Gemini] Stream ended. Final Genkit Output:', finalOutput);

          const finalMessage = {
            type: 'final',
            answer: typeof finalOutput === 'string' ? finalOutput : (finalOutput?.answer || ""), 
            // references: finalOutput?.references || [], // If your prompt/flow structures references
            // debugInfo: finalOutput?.debugInfo,
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalMessage)}\n\n`));

        } catch (error: any) {
          console.error('[Next API /chat - Genkit/Gemini] Error streaming from Genkit to client:', error);
          const errorEvent = `data: ${JSON.stringify({type: 'error', error: error.message || 'Streaming error from Genkit/Gemini'})}\n\n`;
          try {
            controller.enqueue(new TextEncoder().encode(errorEvent));
          } catch (enqueueError) {
            console.error("[Next API /chat - Genkit/Gemini] Error enqueuing error message to stream:", enqueueError);
          }
        } finally {
          try {
            controller.close();
            console.log('[Next API /chat - Genkit/Gemini] Stream controller closed.');
          } catch (closeError) {
             console.error("[Next API /chat - Genkit/Gemini] Error closing stream controller:", closeError);
          }
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[Next API /chat - Genkit/Gemini] Outer route error:', error);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({error: 'Invalid JSON in request body.' , details: error.message}, {status: 400});
    }
    return NextResponse.json({error: error.message || 'An unexpected error occurred in /api/chat.'}, {status: 500});
  }
}
