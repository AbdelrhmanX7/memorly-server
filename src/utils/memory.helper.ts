import { Memory } from "../models/memory";
import mongoose from "mongoose";

interface CreateMemoryParams {
  userId: string | mongoose.Types.ObjectId;
  activityType:
    | "file_upload"
    | "chat_created"
    | "message_sent"
    | "friend_request_sent"
    | "friend_request_accepted"
    | "friend_request_rejected";
  metadata?: {
    fileId?: mongoose.Types.ObjectId;
    fileName?: string;
    fileType?: string;
    fileUrl?: string;
    chatId?: mongoose.Types.ObjectId;
    messageId?: mongoose.Types.ObjectId;
    messageText?: string;
    friendRequestId?: mongoose.Types.ObjectId;
    friendId?: mongoose.Types.ObjectId;
    friendUsername?: string;
    [key: string]: any;
  };
}

/**
 * Create a memory entry for user activity
 */
export const createMemory = async ({
  userId,
  activityType,
  metadata = {},
}: CreateMemoryParams): Promise<void> => {
  try {
    await Memory.create({
      userId,
      activityType,
      metadata,
    });
  } catch (error) {
    console.error("Failed to create memory:", error);
    // Don't throw error - memory creation should not break the main flow
  }
};
