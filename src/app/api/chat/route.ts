
// src/app/api/chat/route.ts
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {ai} from '@/ai/genkit'; // Use the global Genkit AI instance
import {prompt as chatTutorPrompt, ChatTutorInputSchema} from '@/ai/flows/chat-tutor'; // Import the prompt and input schema

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

// Updated schema: removed authToken as it's not directly used by Genkit call here
const ApiRouteInputSchema = ChatTutorInputSchema.omit({ authToken: undefined }); // Or just redefine if simpler

export async function POST(request: Request) {
  console.log('[Next API /chat - Genkit/Gemini] Received request');
  let requestBody;
  try {
    requestBody = await request.json();
    const validation = ApiRouteInputSchema.safeParse(requestBody);

    if (!validation.success) {
      console.error('[Next API /chat - Genkit/Gemini] Invalid input:', validation.error.format());
      return NextResponse.json({error: 'Invalid input', details: validation.error.format()}, {status: 400});
    }

    const {query, documentContent, threadId } = validation.data;
    console.log(`[Next API /chat - Genkit/Gemini] Processing query: "${query}", doc: "${documentContent || 'None'}", thread: "${threadId || 'None'}"`);

    // Prepare input for the Genkit prompt
    const promptInput = {
      question: query,
      documentContent: documentContent, // This will be the actual content or the placeholder string
      threadId: threadId,
    };

    // Use Genkit to generate a streaming response
    const {stream, response} = ai.generateStream({
      prompt: chatTutorPrompt, // Use the imported prompt from chat-tutor.ts
      input: promptInput,
      // Potentially add model: 'googleai/gemini-1.5-flash-latest' here if you want to override the default from ai.ts
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
          
          // After stream finishes, send a final message which can include threadId or other metadata.
          // The 'response' promise from generateStream resolves after all chunks are processed.
          const finalGenkitResponse = await response;
          const finalOutput = finalGenkitResponse.output(); // This might be structured if prompt had output schema

          console.log('[Next API /chat - Genkit/Gemini] Stream ended. Final Genkit Output:', finalOutput);

          const finalMessage = {
            type: 'final',
            answer: finalOutput?.answer || "", // If output is structured, extract answer
                                              // If not, the answer was built from chunks client-side.
                                              // This final 'answer' here might be redundant if client already has full text.
            threadId: threadId || finalOutput?.threadId, // Pass back threadId
            references: finalOutput?.references || [],   // Pass back any structured references
            thinking: finalOutput?.thinking,             // Pass back thinking process
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

    return new Response(clientReadableStream, {
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
