import { Response } from "express";
import { Message } from "../models/message";
import { Chat } from "../models/chat";
import { handleError } from "../utils/handle-error";
import { AuthRequest } from "../types/express";
import { createMemory } from "../utils/memory.helper";
import { generateAIResponseStream } from "../services/ai-chat.service";

export const createMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { chatId, text, senderType } = req.body;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Validate required fields
    if (!chatId || !text || !senderType) {
      handleError({
        res,
        error: new Error("chatId, text, and senderType are required"),
        statusCode: 400,
      });
      return;
    }

    // Validate senderType
    if (senderType !== "user" && senderType !== "system") {
      handleError({
        res,
        error: new Error("senderType must be either 'user' or 'system'"),
        statusCode: 400,
      });
      return;
    }

    // Check if chat exists and belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      handleError({
        res,
        error: new Error("Chat not found"),
        statusCode: 404,
      });
      return;
    }

    // Create new message
    const message = new Message({
      userId,
      chatId,
      text,
      senderType,
    });

    await message.save();

    // Update chat's updatedAt timestamp
    chat.updatedAt = new Date();
    await chat.save();

    // Create memory for user messages only (not system messages)
    if (senderType === "user") {
      await createMemory({
        userId,
        activityType: "message_sent",
        metadata: {
          chatId: message.chatId as any,
          messageId: message._id as any,
          messageText: text.substring(0, 100), // Store first 100 chars
        },
      });
    }

    // Return the created message
    // Note: For AI responses, use the /chat/generate endpoint which supports streaming
    res.status(201).json({
      success: true,
      message: "Message created successfully",
      data: {
        message: {
          id: message._id,
          userId: message.userId,
          chatId: message.chatId,
          text: message.text,
          senderType: message.senderType,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Create message error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const getChatMessages = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Check if chat exists and belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      handleError({
        res,
        error: new Error("Chat not found"),
        statusCode: 404,
      });
      return;
    }

    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: {
        messages: messages.map((msg) => ({
          id: msg._id,
          userId: msg.userId,
          chatId: msg.chatId,
          text: msg.text,
          senderType: msg.senderType,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Get chat messages error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const deleteMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    const message = await Message.findOneAndDelete({
      _id: messageId,
      userId,
    });

    if (!message) {
      handleError({
        res,
        error: new Error("Message not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data: null,
    });
  } catch (error: unknown) {
    console.error("Delete message error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

/**
 * Generate AI response with streaming (SSE)
 * Pipeline:
 * 1. Save user message to database
 * 2. Retrieve relevant memories (via LLM service)
 * 3. Generate conversational response (via LLM service)
 * 4. Stream response to client in SSE format
 */
export const generateStreamingResponse = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { chatId, text, limit } = req.body;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Validate required fields
    if (!chatId || !text) {
      handleError({
        res,
        error: new Error("chatId and text are required"),
        statusCode: 400,
      });
      return;
    }

    // Check if chat exists and belongs to user
    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      handleError({
        res,
        error: new Error("Chat not found"),
        statusCode: 404,
      });
      return;
    }

    // Save user message
    const userMessage = new Message({
      userId,
      chatId,
      text,
      senderType: "user",
    });

    await userMessage.save();

    // Update chat's updatedAt timestamp
    chat.updatedAt = new Date();
    await chat.save();

    // Create memory for user message
    await createMemory({
      userId,
      activityType: "message_sent",
      metadata: {
        chatId: userMessage.chatId as any,
        messageId: userMessage._id as any,
        messageText: text.substring(0, 100),
      },
    });

    console.log(
      `Streaming AI response for user ${userId}, chat ${chatId}, query: "${text}"`
    );

    // Get streaming response from LLM service
    const stream = await generateAIResponseStream(
      userId,
      text,
      limit || 10
    );

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Collect AI response chunks
    let aiResponseText = "";
    let hasError = false;

    // Process stream data
    stream.on("data", (chunk) => {
      const chunkStr = chunk.toString();

      // Forward chunk to client
      res.write(chunk);

      // Parse SSE chunks to collect AI response
      const lines = chunkStr.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const jsonData = JSON.parse(line.slice(6));

            // Collect text chunks (response type from LLM service)
            console.log(jsonData.data)
            if (jsonData.type === "response" && jsonData.data) {
              aiResponseText += jsonData.data;
            }

            // Track errors
            if (jsonData.type === "error") {
              hasError = true;
            }
          } catch (parseError) {
            // Skip malformed JSON
            console.error("Failed to parse SSE chunk:", parseError);
          }
        }
      }
    });

    // Handle stream errors
    stream.on("error", (error) => {
      console.error("Stream error:", error);
      hasError = true;
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error streaming AI response",
        });
      }
    });

    // Handle stream end - save AI response to database
    stream.on("end", async () => {
      console.log(aiResponseText)
      console.log("Stream ended");

      // Save AI response to database if we have text and no errors
      if (aiResponseText.trim() && !hasError) {
        try {
          const aiMessage = new Message({
            userId,
            chatId,
            text: aiResponseText,
            senderType: "system",
          });

          await aiMessage.save();
          console.log(`AI response saved to database: ${aiMessage._id}`);
        } catch (saveError) {
          console.error("Failed to save AI response to database:", saveError);
        }
      }

      res.end();
    });
  } catch (error: unknown) {
    console.error("Generate streaming response error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};
