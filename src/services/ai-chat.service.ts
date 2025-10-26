import { Message } from "../models/message";
import { File } from "../models/file";

/**
 * Build the AI prompt with memory context
 */
const buildMemoryPrompt = (userQuery: string, retrievedData: any[]): string => {
  return `You are an intelligent personal memory assistant that helps the user recall details, summarize moments, and answer questions from their stored multimodal memories.

Your task is to answer the user's query using the retrieved context below.
Each memory entry contains structured metadata such as modality (video, audio, document, etc.), timestamps, people, locations, tags, and textual content.

Use only the information in the retrieved data to answer accurately.
If the context is insufficient, clearly say you don't have enough information.

---
USER QUERY:
${userQuery}

---
RETRIEVED CONTEXT (from vector database):
${JSON.stringify(retrievedData, null, 2)}

Each entry in the context follows this format:
[
  {
    "id": "...",
    "modality": "...",
    "content": "...",
    "timestamp": "...",
    "location": "...",
    "people": [...],
    "objects": [...],
    "tags": [...],
    "source_path": "...",
    "start_timestamp_video": ...,
    "end_timestamp_video": ...,
    "$meta": {...}
  },
  ...
]

---
INSTRUCTIONS:
1. Read all retrieved entries carefully and synthesize a concise, factual, and human-readable answer to the query.
2. When possible, reference people, places, or timestamps to help the user remember.
3. If multiple memories seem related, merge them coherently.
4. If modality includes "video" or "audio", infer actions or events described by the content.
5. Do not invent details that are not explicitly or implicitly supported by the retrieved data.

---
FINAL ANSWER:
(Provide a clear, natural answer for the user below)`;
};

/**
 * Retrieve relevant memories based on user query
 * This is a placeholder - you should integrate with your vector database
 */
const retrieveRelevantMemories = async (
  userId: string,
  userQuery: string
): Promise<any[]> => {
  // TODO: Replace with actual vector database search
  // For now, we'll fetch recent files and messages as context

  const [recentFiles, recentMessages] = await Promise.all([
    File.find({ userId })
      .sort({ uploadedAt: -1 })
      .limit(5)
      .lean(),
    Message.find({ userId, senderType: "user" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Transform to memory format
  const memories: any[] = [];

  // Add files as memories
  recentFiles.forEach((file: any) => {
    memories.push({
      id: file._id.toString(),
      modality: file.fileType,
      content: `File: ${file.originalName || file.fileName}`,
      timestamp: file.uploadedAt || file.createdAt,
      source_path: file.fileUrl,
      tags: [file.fileType],
      $meta: {
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      },
    });
  });

  // Add messages as memories
  recentMessages.forEach((message: any) => {
    memories.push({
      id: message._id.toString(),
      modality: "text",
      content: message.text,
      timestamp: message.createdAt,
      tags: ["message", "chat"],
    });
  });

  return memories;
};

/**
 * Generate AI response for user message
 */
export const generateAIResponse = async (
  userId: string,
  chatId: string,
  userMessage: string
): Promise<string> => {
  try {
    // Retrieve relevant memories
    const memories = await retrieveRelevantMemories(userId, userMessage);

    // Build prompt
    const prompt = buildMemoryPrompt(userMessage, memories);

    // Get AI instance from global
    const ai = global.ai;

    if (!ai) {
      throw new Error("AI not initialized");
    }

    // Generate response using Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });

    // Extract text from response
    const aiResponse = response.text || "";

    return aiResponse || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("AI response generation error:", error);
    throw new Error("Failed to generate AI response");
  }
};

/**
 * Get chat history for context
 */
export const getChatHistory = async (
  chatId: string,
  limit: number = 10
): Promise<any[]> => {
  const messages = await Message.find({ chatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse(); // Return in chronological order
};
