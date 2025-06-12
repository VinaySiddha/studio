
// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import {z} from 'zod';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

const ChatApiInputSchema = z.object({
  query: z.string(),
  documentContent: z.string().optional(), 
  threadId: z.string().optional(),
  authToken: z.string().optional(), // Added authToken
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ChatApiInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({error: 'Invalid input', details: validation.error.format()}, {status: 400});
    }

    const {query, documentContent, threadId, authToken } = validation.data;

    const flaskRequestBody = {
      query: query,
      documentContent: documentContent || "No document provided for context.",
      thread_id: threadId,
    };

    const headersToFlask: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headersToFlask['Authorization'] = `Bearer ${authToken}`;
    }

    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/chat`, {
      method: 'POST',
      headers: headersToFlask,
      body: JSON.stringify(flaskRequestBody),
    });

    if (!flaskResponse.ok || !flaskResponse.body) {
      const errorData = await flaskResponse.json().catch(() => ({ message: `Flask API error! Status: ${flaskResponse.status}` }));
      console.error('Flask chat API error:', errorData);
      return NextResponse.json({error: errorData.message || errorData.error || 'Failed to connect to Flask chat API.'}, {status: flaskResponse.status});
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = flaskResponse.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            controller.enqueue(value); 
          }
        } catch (error: any) {
          console.error('Error streaming from Flask to client:', error);
          const errorEvent = `data: ${JSON.stringify({type: 'error', error: error.message || 'Streaming proxy error'})}\n\n`;
          try {
            controller.enqueue(new TextEncoder().encode(errorEvent));
          } catch (enqueueError) {
            console.error("Error enqueuing error message to stream:", enqueueError);
          }
        } finally {
          try {
            controller.close();
          } catch (closeError) {
             console.error("Error closing stream controller:", closeError);
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
    console.error('API /chat route error:', error);
    return NextResponse.json({error: error.message || 'An unexpected error occurred in /api/chat.'}, {status: 500});
  }
}
// Note: This code is designed to be used in a Next.js API route.
// It handles POST requests to the /api/chat endpoint, validates input using Zod,
// and streams responses from a Flask backend chat API.
// The code includes error handling for both input validation and Flask API communication.