
// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import {z} from 'zod';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';

const ChatApiInputSchema = z.object({
  query: z.string(),
  documentContent: z.string().optional(), // This will be the document filename or a placeholder
  threadId: z.string().optional(),
  // authToken: z.string(), // Assuming auth is handled if Flask endpoint is protected
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ChatApiInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({error: 'Invalid input', details: validation.error.format()}, {status: 400});
    }

    const {query, documentContent, threadId, /* authToken */} = validation.data;

    // Prepare the request to Flask backend's /chat endpoint
    const flaskRequestBody = {
      query: query,
      // Flask expects 'documentContent' to be the filename or a placeholder like "No document provided for context."
      // If no document is selected in frontend, documentContent will be "No document provided for context."
      documentContent: documentContent || "No document provided for context.",
      thread_id: threadId, // Flask expects thread_id
    };

    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If your Flask /chat endpoint is protected, you'll need to pass the auth token
        // 'Authorization': `Bearer ${authToken}`, 
      },
      body: JSON.stringify(flaskRequestBody),
      // IMPORTANT: For streaming, you might need to handle this differently if not using a simple proxy.
      // However, Next.js fetch should handle streaming responses if Flask sends them correctly.
    });

    if (!flaskResponse.ok || !flaskResponse.body) {
      const errorData = await flaskResponse.json().catch(() => ({ message: `Flask API error! Status: ${flaskResponse.status}` }));
      console.error('Flask chat API error:', errorData);
      return NextResponse.json({error: errorData.message || errorData.error || 'Failed to connect to Flask chat API.'}, {status: flaskResponse.status});
    }

    // Stream the response from Flask back to the client
    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = flaskResponse.body!.getReader();
        const decoder = new TextDecoder(); // To decode Flask's SSE chunks

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            // Assuming Flask sends SSE in the format "data: {...}\n\n"
            // The client-side ChatTutorSection already expects this format.
            controller.enqueue(value); // Forward the raw chunk
          }
        } catch (error: any) {
          console.error('Error streaming from Flask to client:', error);
          // Try to send an error event through SSE if possible
          const errorEvent = `data: ${JSON.stringify({type: 'error', error: error.message || 'Streaming proxy error'})}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorEvent));
        } finally {
          controller.close();
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
