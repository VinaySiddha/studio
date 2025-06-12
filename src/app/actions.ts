// src/app/actions.ts
'use server';

import {
  chatTutor as chatTutorFlow,
  type ChatTutorInput,
  type ChatTutorOutput
} from '@/ai/flows/chat-tutor';
import {
  generateFaq as generateFaqFlow,
  type GenerateFaqInput,
  type GenerateFaqOutput
} from '@/ai/flows/generate-faq';
import {
  generateTopics as generateTopicsFlow,
  type GenerateTopicsInput,
  type GenerateTopicsOutput
} from '@/ai/flows/generate-topics';
import {
  generateMindMap as generateMindMapFlow,
  type GenerateMindMapInput,
  type GenerateMindMapOutput
} from '@/ai/flows/generate-mind-map';
import {
  generatePodcastScript as generatePodcastScriptFlow,
  type GeneratePodcastScriptInput,
  type GeneratePodcastScriptOutput
} from '@/ai/flows/generate-podcast-script';

export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  try {
    return await chatTutorFlow(input);
  } catch (error) {
    console.error("Error in chatTutor server action:", error);
    throw new Error("Failed to get response from AI tutor.");
  }
}

export async function generateFaq(input: GenerateFaqInput): Promise<GenerateFaqOutput> {
   try {
    return await generateFaqFlow(input);
  } catch (error) {
    console.error("Error in generateFaq server action:", error);
    throw new Error("Failed to generate FAQ.");
  }
}

export async function generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
  try {
    return await generateTopicsFlow(input);
  } catch (error) {
    console.error("Error in generateTopics server action:", error);
    throw new Error("Failed to generate topics.");
  }
}

export async function generateMindMap(input: GenerateMindMapInput): Promise<GenerateMindMapOutput> {
   try {
    return await generateMindMapFlow(input);
  } catch (error) {
    console.error("Error in generateMindMap server action:", error);
    throw new Error("Failed to generate mind map.");
  }
}

export async function generatePodcastScript(input: GeneratePodcastScriptInput): Promise<GeneratePodcastScriptOutput> {
  try {
    return await generatePodcastScriptFlow(input);
  } catch (error) {
    console.error("Error in generatePodcastScript server action:", error);
    throw new Error("Failed to generate podcast script.");
  }
}
