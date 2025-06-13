// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// This should match the URL of your Flask backend
const FLASK_BACKEND_CHAT_URL = process.env.FLASK_BACKEND_URL ? `${process.env.FLASK_BACKEND_URL}/chat` : 'http://localhost:5000/chat';

// Schema for the request body to this Next.js API route
const NextApiChatInputSchema = z.object({
  query: z.string(),
  documentContent: z.string().optional().nullable(), // Name of the document or placeholder
  threadId: z.string().optional().nullable(),
  authToken: z.string(), // User's auth token for Flask backend
});

export async function POST(request: NextRequest) {
  console.log('[Next API /chat -> Flask] Received request');
  let requestBodyFromClient;

  try {
    requestBodyFromClient = await request.json();
    const validation = NextApiChatInputSchema.safeParse(requestBodyFromClient);

    if (!validation.success) {
      console.error('[Next API /chat -> Flask] Invalid input from client:', validation.error.format());
      return NextResponse.json({ error: 'Invalid input to Next.js API route', details: validation.error.format() }, { status: 400 });
    }

    const { query, documentContent, threadId, authToken } = validation.data;
    
    console.log(`[Next API /chat -> Flask] Processing query: "${query.substring(0, 50)}..."`);
    console.log(`[Next API /chat -> Flask] Document Context: ${documentContent}`);
    console.log(`[Next API /chat -> Flask] Thread ID: ${threadId}`);

    const flaskRequestBody = {
      query,
      documentContent: documentContent, // Flask expects this field name
      thread_id: threadId, // Flask expects thread_id
    };

    const flaskResponse = await fetch(FLASK_BACKEND_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`, // Pass token to Flask
      },
      body: JSON.stringify(flaskRequestBody),
      // IMPORTANT: Duplex must be 'half' for streaming with undici/Node.js 18+
      // However, for Next.js Edge/Vercel, this might not be needed or allowed.
      // If running in Node.js env, and fetch is from undici, 'half' is necessary.
      // For Vercel, this option might cause issues. Let's assume standard fetch for now.
      // duplex: 'half', // Uncomment if needed for your specific Node.js fetch version
    });

    console.log(`[Next API /chat -> Flask] Flask response status: ${flaskResponse.status}`);

    if (!flaskResponse.ok) {
      let errorBody = 'Failed to get response from Flask backend.';
      try {
        const flaskError = await flaskResponse.json();
        errorBody = flaskError.error || flaskError.message || JSON.stringify(flaskError);
      } catch (e) {
        errorBody = await flaskResponse.text();
      }
      console.error(`[Next API /chat -> Flask] Error from Flask: ${flaskResponse.status}`, errorBody);
      return NextResponse.json({ error: 'Error from AI backend', details: errorBody }, { status: flaskResponse.status });
    }

    if (!flaskResponse.body) {
      console.error('[Next API /chat -> Flask] Flask response body is null.');
      return NextResponse.json({ error: 'AI backend returned no content.' }, { status: 500 });
    }

    // Forward the stream from Flask to the client
    const stream = flaskResponse.body;
    
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[Next API /chat -> Flask] Outer route error:', error);
    let errorMessage = 'An unexpected error occurred in /api/chat.';
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        errorMessage = 'Invalid JSON in request body to Next.js API route.';
        return NextResponse.json({ error: errorMessage, details: error.message }, { status: 400 });
    }
    if (error.code === 'ECONNREFUSED') {
        errorMessage = `Connection to Flask backend (${FLASK_BACKEND_CHAT_URL}) refused. Is the Flask server running?`;
        return NextResponse.json({ error: "AI service connection failed.", details: errorMessage}, {status: 503});
    }
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
