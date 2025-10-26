import { Response } from "express";
import { Chat } from "../models/chat";
import { handleError } from "../utils/handle-error";
import { AuthRequest } from "../types/express";
import { createMemory } from "../utils/memory.helper";

export const createChat = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Create new chat
    const chat = new Chat({
      userId,
    });

    await chat.save();

    // Create memory for chat creation
    await createMemory({
      userId,
      activityType: "chat_created",
      metadata: {
        chatId: chat._id as any,
      },
    });

    res.status(201).json({
      success: true,
      message: "Chat created successfully",
      data: {
        chat: {
          id: chat._id,
          userId: chat.userId,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Create chat error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const getUserChats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    const chats = await Chat.find({ userId }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: "Chats retrieved successfully",
      data: {
        chats: chats.map((chat) => ({
          id: chat._id,
          userId: chat.userId,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Get user chats error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const getChatById = async (
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

    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      handleError({
        res,
        error: new Error("Chat not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Chat retrieved successfully",
      data: {
        chat: {
          id: chat._id,
          userId: chat.userId,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Get chat by ID error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const deleteChat = async (
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

    const chat = await Chat.findOneAndDelete({ _id: chatId, userId });

    if (!chat) {
      handleError({
        res,
        error: new Error("Chat not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Chat deleted successfully",
      data: null,
    });
  } catch (error: unknown) {
    console.error("Delete chat error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};
