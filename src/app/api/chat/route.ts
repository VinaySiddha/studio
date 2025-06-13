
// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import {z} from 'zod';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

const ChatApiInputSchema = z.object({
  query: z.string(),
  documentContent: z.string().optional(),
  threadId: z.string().optional(),
  authToken: z.string().optional(), // AuthToken from the client
});

export async function POST(request: Request) {
  console.log('[Next API /chat] Received request');
  try {
    const body = await request.json();
    const validation = ChatApiInputSchema.safeParse(body);

    if (!validation.success) {
      console.error('[Next API /chat] Invalid input:', validation.error.format());
      return NextResponse.json({error: 'Invalid input', details: validation.error.format()}, {status: 400});
    }

    const {query, documentContent, threadId, authToken } = validation.data;
    console.log(`[Next API /chat] Processing query: "${query}", doc: "${documentContent || 'None'}", thread: "${threadId || 'None'}"`);

    const flaskRequestBody = {
      query: query,
      documentContent: documentContent || "No document provided for context.",
      thread_id: threadId,
    };

    const headersToFlask: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream', // Tell Flask we expect a stream
    };
    if (authToken) {
      headersToFlask['Authorization'] = `Bearer ${authToken}`;
    }

    console.log(`[Next API /chat] Forwarding to Flask: ${FLASK_BACKEND_URL}/chat`);
    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/chat`, {
      method: 'POST',
      headers: headersToFlask,
      body: JSON.stringify(flaskRequestBody),
    });

    console.log(`[Next API /chat] Flask response status: ${flaskResponse.status}`);

    if (!flaskResponse.ok) {
      // If Flask returns an error status before streaming, capture and return it.
      let errorData;
      try {
        errorData = await flaskResponse.json();
        console.error('[Next API /chat] Flask API error (JSON):', errorData);
      } catch (e) {
        const errorText = await flaskResponse.text();
        console.error('[Next API /chat] Flask API error (Non-JSON):', errorText);
        errorData = { message: errorText || `Flask API error! Status: ${flaskResponse.status}` };
      }
      return NextResponse.json({
        error: errorData.message || errorData.error || 'Failed to connect to Flask chat API or Flask returned an error.',
        flask_status: flaskResponse.status,
        flask_response: errorData
      }, {status: 502}); // 502 Bad Gateway, as Next is acting as a gateway to Flask
    }

    if (!flaskResponse.body) {
        console.error('[Next API /chat] Flask response body is null, cannot stream.');
        return NextResponse.json({error: 'Flask response body is null.'}, {status: 500});
    }
    
    console.log('[Next API /chat] Flask response OK, attempting to stream.');
    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = flaskResponse.body!.getReader();
        const decoder = new TextDecoder(); // For decoding SSE chunks
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('[Next API /chat] Flask stream ended.');
              break;
            }
            // Optionally log chunks for debugging
            // console.log('[Next API /chat] Received chunk from Flask:', decoder.decode(value, {stream: true}));
            controller.enqueue(value);
          }
        } catch (error: any) {
          console.error('[Next API /chat] Error streaming from Flask to client:', error);
          const errorEvent = `data: ${JSON.stringify({type: 'error', error: error.message || 'Streaming proxy error'})}\n\n`;
          try {
            controller.enqueue(new TextEncoder().encode(errorEvent));
          } catch (enqueueError) {
            console.error("[Next API /chat] Error enqueuing error message to stream:", enqueueError);
          }
        } finally {
          try {
            controller.close();
            console.log('[Next API /chat] Stream controller closed.');
          } catch (closeError) {
             console.error("[Next API /chat] Error closing stream controller:", closeError);
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
    console.error('[Next API /chat] Outer route error:', error);
    return NextResponse.json({error: error.message || 'An unexpected error occurred in /api/chat.'}, {status: 500});
  }
}
// Note: This code is designed to be used in a Next.js API route.
// It handles POST requests to the /api/chat endpoint, validates input using Zod,
// and streams responses from a Flask backend chat API.
// The code includes error handling for both input validation and Flask API communication.
// Added more detailed logging to diagnose connection/response issues with Flask.
