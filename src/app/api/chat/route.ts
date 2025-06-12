
// src/app/api/chat/route.ts
import {ai} from '@/ai/genkit';
import {prompt as chatTutorPrompt, ChatTutorInputSchema, type ChatTutorInput} from '@/ai/flows/chat-tutor';
import {NextResponse} from 'next/server';
import {z} from 'zod';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

const ChatApiInputSchema = z.object({
  query: z.string(),
  documentContent: z.string().optional(),
  threadId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ChatApiInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({error: 'Invalid input', details: validation.error.format()}, {status: 400});
    }

    const {query, documentContent, threadId: existingThreadId} = validation.data;

    const genkitInput: ChatTutorInput = {
      question: query,
      documentContent: documentContent || "No document provided for context.",
      threadId: existingThreadId,
    };

    const {stream, response: finalResponsePromise} = ai.generateStream({
      prompt: chatTutorPrompt, // Use the imported prompt object
      input: genkitInput,
      // history: [], // TODO: Implement chat history management if needed
    });

    const textEncoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // Simulate a thread ID (in a real app, this would come from a DB or session)
        // For now, if no threadId is passed, generate a new one.
        // The prompt output schema includes threadId, so finalResponsePromise could update it.
        let currentThreadId = existingThreadId || `thread_${Date.now()}`;

        // Helper to send SSE data
        const sendData = (data: object) => {
          controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          for await (const chunk of stream) {
            if (chunk.text) {
              sendData({type: 'chunk', content: chunk.text});
            }
            // Genkit stream chunks can also contain tool calls, custom data, etc.
            // For this chat, we're primarily interested in text.
          }

          // Wait for the full response to potentially get structured output like references, thinking, or updated threadId
          const finalOutput = await finalResponsePromise;
          const finalAnswer = finalOutput.output?.answer || '';
          const references = finalOutput.output?.references || [];
          const thinking = finalOutput.output?.thinking;
          const resolvedThreadId = finalOutput.output?.threadId || currentThreadId;


          sendData({
            type: 'final',
            answer: finalAnswer, // May be empty if all content was in chunks
            references,
            thinking,
            threadId: resolvedThreadId,
          });

        } catch (error: any) {
          console.error('Streaming error:', error);
          sendData({type: 'error', message: error.message || 'An error occurred during streaming.'});
        } finally {
          controller.close();
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
    console.error('API /chat error:', error);
    return NextResponse.json({error: error.message || 'An unexpected error occurred.'}, {status: 500});
  }
}
