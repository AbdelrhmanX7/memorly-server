import { Response } from "express";
import { Message } from "../models/message";
import { Chat } from "../models/chat";
import { handleError } from "../utils/handle-error";
import { AuthRequest } from "../types/express";
import { createMemory } from "../utils/memory.helper";
import { generateAIResponse } from "../services/ai-chat.service";

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

    // For user messages, generate AI response and return both messages
    if (senderType === "user") {
      try {
        // Generate AI response (this will wait for AI)
        const aiResponseText = await generateAIResponse(userId, chatId, text);

        // Save AI response as system message
        const aiMessage = new Message({
          userId,
          chatId,
          text: aiResponseText,
          senderType: "system",
        });

        await aiMessage.save();

        // Update chat's updatedAt timestamp
        chat.updatedAt = new Date();
        await chat.save();

        // Return both user message and AI response
        res.status(201).json({
          success: true,
          message: "Message created and AI response generated successfully",
          data: {
            userMessage: {
              id: message._id,
              userId: message.userId,
              chatId: message.chatId,
              text: message.text,
              senderType: message.senderType,
              createdAt: message.createdAt,
              updatedAt: message.updatedAt,
            },
            aiMessage: {
              id: aiMessage._id,
              userId: aiMessage.userId,
              chatId: aiMessage.chatId,
              text: aiMessage.text,
              senderType: aiMessage.senderType,
              createdAt: aiMessage.createdAt,
              updatedAt: aiMessage.updatedAt,
            },
          },
        });
      } catch (aiError) {
        console.error("AI response generation error:", aiError);

        // If AI fails, still return the user message
        res.status(201).json({
          success: true,
          message: "Message created successfully (AI response failed)",
          data: {
            userMessage: {
              id: message._id,
              userId: message.userId,
              chatId: message.chatId,
              text: message.text,
              senderType: message.senderType,
              createdAt: message.createdAt,
              updatedAt: message.updatedAt,
            },
            aiMessage: null,
            error: "AI response generation failed. Please try again.",
          },
        });
      }
    } else {
      // For system messages, just return the message
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
    }
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
