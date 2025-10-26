import { Response } from "express";
import { Memory } from "../models/memory";
import { File } from "../models/file";
import { Chat } from "../models/chat";
import { Message } from "../models/message";
import { Friend } from "../models/friend";
import { handleError } from "../utils/handle-error";
import { AuthRequest } from "../types/express";
import mongoose from "mongoose";

/**
 * Helper function to sync missing activities to Memory model
 * This runs in the background and doesn't block the response
 */
const syncMissingMemories = async (
  userId: string,
  activities: any[]
): Promise<void> => {
  try {
    // Get all existing memory IDs for this user to avoid duplicates
    const existingMemories = await Memory.find({ userId }).select("metadata").lean();

    // Create a Set of existing activity identifiers for quick lookup
    const existingIds = new Set<string>();

    existingMemories.forEach((memory: any) => {
      // Create unique identifier based on activity type and relevant IDs
      if (memory.metadata.fileId) {
        existingIds.add(`file_${memory.metadata.fileId}`);
      }
      if (memory.metadata.chatId && !memory.metadata.messageId) {
        existingIds.add(`chat_${memory.metadata.chatId}`);
      }
      if (memory.metadata.messageId) {
        existingIds.add(`message_${memory.metadata.messageId}`);
      }
      if (memory.metadata.friendRequestId) {
        const type = memory.activityType.replace("friend_request_", "");
        existingIds.add(`friend_${memory.metadata.friendRequestId}_${type}`);
      }
    });

    // Find activities that don't have corresponding memories
    const missingActivities = activities.filter((activity) => {
      let identifier = "";

      switch (activity.activityType) {
        case "file_upload":
          identifier = `file_${activity.metadata.fileId}`;
          break;
        case "chat_created":
          identifier = `chat_${activity.metadata.chatId}`;
          break;
        case "message_sent":
          identifier = `message_${activity.metadata.messageId}`;
          break;
        case "friend_request_sent":
          identifier = `friend_${activity.metadata.friendRequestId}_sent`;
          break;
        case "friend_request_accepted":
          identifier = `friend_${activity.metadata.friendRequestId}_accepted`;
          break;
        case "friend_request_rejected":
          identifier = `friend_${activity.metadata.friendRequestId}_rejected`;
          break;
        default:
          return false;
      }

      return !existingIds.has(identifier);
    });

    // Bulk insert missing memories
    if (missingActivities.length > 0) {
      const memoriesToInsert = missingActivities.map((activity) => ({
        userId: new mongoose.Types.ObjectId(userId),
        activityType: activity.activityType,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
        updatedAt: activity.createdAt,
      }));

      await Memory.insertMany(memoriesToInsert, { ordered: false });

      console.log(`Synced ${memoriesToInsert.length} missing memories for user ${userId}`);
    }
  } catch (error: any) {
    // Ignore duplicate key errors (race conditions)
    if (error.code !== 11000) {
      console.error("Error syncing missing memories:", error);
    }
  }
};

/**
 * Get user's memories timeline with daily grouping and pagination
 * GET /memories/timeline
 *
 * This function aggregates activities from multiple sources:
 * - File uploads (from File model)
 * - Chat creation (from Chat model)
 * - Messages sent (from Message model)
 * - Friend requests (from Friend model)
 *
 * It also syncs any missing activities to the Memory model in the background
 */
export const getMemoriesTimeline = async (
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

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Optional activity type filter
    const activityType = req.query.activityType as string | undefined;

    // Aggregate all activities from different sources
    const allActivities: any[] = [];

    // 1. Get file uploads (if no filter or filter is 'file_upload')
    if (!activityType || activityType === "file_upload") {
      const files = await File.find({ userId })
        .sort({ uploadedAt: -1 })
        .lean();

      files.forEach((file: any) => {
        allActivities.push({
          id: file._id,
          activityType: "file_upload",
          metadata: {
            fileId: file._id,
            fileName: file.fileName,
            originalName: file.originalName,
            fileType: file.fileType,
            fileUrl: file.fileUrl,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
          },
          createdAt: file.uploadedAt || file.createdAt,
          source: "files",
        });
      });
    }

    // 2. Get chat creation (if no filter or filter is 'chat_created')
    if (!activityType || activityType === "chat_created") {
      const chats = await Chat.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      chats.forEach((chat: any) => {
        allActivities.push({
          id: chat._id,
          activityType: "chat_created",
          metadata: {
            chatId: chat._id,
          },
          createdAt: chat.createdAt,
          source: "chats",
        });
      });
    }

    // 3. Get user messages (if no filter or filter is 'message_sent')
    if (!activityType || activityType === "message_sent") {
      const messages = await Message.find({
        userId,
        senderType: "user", // Only user messages
      })
        .sort({ createdAt: -1 })
        .lean();

      messages.forEach((message: any) => {
        allActivities.push({
          id: message._id,
          activityType: "message_sent",
          metadata: {
            chatId: message.chatId,
            messageId: message._id,
            messageText: message.text.substring(0, 100), // First 100 chars
          },
          createdAt: message.createdAt,
          source: "messages",
        });
      });
    }

    // 4. Get friend requests sent (if no filter or filter is 'friend_request_sent')
    if (!activityType || activityType === "friend_request_sent") {
      const sentRequests = await Friend.find({
        senderId: userId,
      })
        .populate("receiverId", "username")
        .sort({ createdAt: -1 })
        .lean();

      sentRequests.forEach((request: any) => {
        allActivities.push({
          id: request._id,
          activityType: "friend_request_sent",
          metadata: {
            friendRequestId: request._id,
            friendId: request.receiverId._id,
            friendUsername: request.receiverId.username,
            status: request.status,
          },
          createdAt: request.createdAt,
          source: "friends",
        });
      });
    }

    // 5. Get friend requests accepted (if no filter or filter is 'friend_request_accepted')
    if (!activityType || activityType === "friend_request_accepted") {
      const acceptedRequests = await Friend.find({
        receiverId: userId,
        status: "accepted",
      })
        .populate("senderId", "username")
        .sort({ updatedAt: -1 })
        .lean();

      acceptedRequests.forEach((request: any) => {
        allActivities.push({
          id: `${request._id}-accepted`,
          activityType: "friend_request_accepted",
          metadata: {
            friendRequestId: request._id,
            friendId: request.senderId._id,
            friendUsername: request.senderId.username,
          },
          createdAt: request.updatedAt, // Use updatedAt for when it was accepted
          source: "friends",
        });
      });
    }

    // 6. Get friend requests rejected (if no filter or filter is 'friend_request_rejected')
    if (!activityType || activityType === "friend_request_rejected") {
      const rejectedRequests = await Friend.find({
        receiverId: userId,
        status: "rejected",
      })
        .populate("senderId", "username")
        .sort({ updatedAt: -1 })
        .lean();

      rejectedRequests.forEach((request: any) => {
        allActivities.push({
          id: `${request._id}-rejected`,
          activityType: "friend_request_rejected",
          metadata: {
            friendRequestId: request._id,
            friendId: request.senderId._id,
            friendUsername: request.senderId.username,
          },
          createdAt: request.updatedAt, // Use updatedAt for when it was rejected
          source: "friends",
        });
      });
    }

    // Sort all activities by creation date (newest first)
    allActivities.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Calculate pagination
    const totalCount = allActivities.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination
    const paginatedActivities = allActivities.slice(skip, skip + limit);

    // Group activities by date
    const groupedByDate: Record<string, any[]> = paginatedActivities.reduce(
      (acc: Record<string, any[]>, activity: any) => {
        const date = new Date(activity.createdAt);
        const dateKey = date.toISOString().split("T")[0] as string; // YYYY-MM-DD format

        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }

        // Remove the 'source' field before sending to client
        const { source, ...activityWithoutSource } = activity;

        acc[dateKey]!.push(activityWithoutSource);

        return acc;
      },
      {}
    );

    // Convert to array format for easier frontend consumption
    const timeline = Object.keys(groupedByDate).map((date) => ({
      date,
      activities: groupedByDate[date]!,
      count: groupedByDate[date]!.length,
    }));

    // Sync missing activities to Memory model in the background (don't await)
    // This ensures the Memory model stays up-to-date without blocking the response
    syncMissingMemories(userId, allActivities).catch((error) => {
      console.error("Background sync error:", error);
    });

    res.status(200).json({
      success: true,
      message: "Timeline retrieved successfully",
      data: {
        timeline,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Get memories timeline error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

/**
 * Get memories for a specific date
 * GET /memories/date/:date
 */
export const getMemoriesByDate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { date } = req.params; // Expected format: YYYY-MM-DD

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !dateRegex.test(date)) {
      handleError({
        res,
        error: new Error("Invalid date format. Use YYYY-MM-DD"),
        statusCode: 400,
      });
      return;
    }

    // Create date range for the entire day
    const startDate = new Date(date as string);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(date as string);
    endDate.setUTCHours(23, 59, 59, 999);

    // Fetch memories for the specific date
    const memories = await Memory.find({
      userId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: "Memories retrieved successfully",
      data: {
        date,
        activities: memories.map((memory: any) => ({
          id: memory._id,
          activityType: memory.activityType,
          metadata: memory.metadata,
          createdAt: memory.createdAt,
        })),
        count: memories.length,
      },
    });
  } catch (error: unknown) {
    console.error("Get memories by date error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

/**
 * Delete a specific memory
 * DELETE /memories/:memoryId
 */
export const deleteMemory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { memoryId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    const memory = await Memory.findOneAndDelete({
      _id: memoryId,
      userId,
    });

    if (!memory) {
      handleError({
        res,
        error: new Error("Memory not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Memory deleted successfully",
      data: null,
    });
  } catch (error: unknown) {
    console.error("Delete memory error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

/**
 * Manually sync all activities to Memory model
 * POST /memories/sync
 *
 * This endpoint triggers a full sync of all activities to the Memory model.
 * Useful for initial setup or if the Memory model gets out of sync.
 */
export const syncMemories = async (
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

    // Collect all activities (same logic as timeline but without pagination)
    const allActivities: any[] = [];

    // Get all files
    const files = await File.find({ userId }).lean();
    files.forEach((file: any) => {
      allActivities.push({
        id: file._id,
        activityType: "file_upload",
        metadata: {
          fileId: file._id,
          fileName: file.fileName,
          originalName: file.originalName,
          fileType: file.fileType,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        },
        createdAt: file.uploadedAt || file.createdAt,
      });
    });

    // Get all chats
    const chats = await Chat.find({ userId }).lean();
    chats.forEach((chat: any) => {
      allActivities.push({
        id: chat._id,
        activityType: "chat_created",
        metadata: {
          chatId: chat._id,
        },
        createdAt: chat.createdAt,
      });
    });

    // Get all user messages
    const messages = await Message.find({
      userId,
      senderType: "user",
    }).lean();
    messages.forEach((message: any) => {
      allActivities.push({
        id: message._id,
        activityType: "message_sent",
        metadata: {
          chatId: message.chatId,
          messageId: message._id,
          messageText: message.text.substring(0, 100),
        },
        createdAt: message.createdAt,
      });
    });

    // Get all friend requests
    const sentRequests = await Friend.find({ senderId: userId })
      .populate("receiverId", "username")
      .lean();
    sentRequests.forEach((request: any) => {
      allActivities.push({
        id: request._id,
        activityType: "friend_request_sent",
        metadata: {
          friendRequestId: request._id,
          friendId: request.receiverId?._id,
          friendUsername: request.receiverId?.username,
          status: request.status,
        },
        createdAt: request.createdAt,
      });
    });

    const acceptedRequests = await Friend.find({
      receiverId: userId,
      status: "accepted",
    })
      .populate("senderId", "username")
      .lean();
    acceptedRequests.forEach((request: any) => {
      allActivities.push({
        id: `${request._id}-accepted`,
        activityType: "friend_request_accepted",
        metadata: {
          friendRequestId: request._id,
          friendId: request.senderId?._id,
          friendUsername: request.senderId?.username,
        },
        createdAt: request.updatedAt,
      });
    });

    const rejectedRequests = await Friend.find({
      receiverId: userId,
      status: "rejected",
    })
      .populate("senderId", "username")
      .lean();
    rejectedRequests.forEach((request: any) => {
      allActivities.push({
        id: `${request._id}-rejected`,
        activityType: "friend_request_rejected",
        metadata: {
          friendRequestId: request._id,
          friendId: request.senderId?._id,
          friendUsername: request.senderId?.username,
        },
        createdAt: request.updatedAt,
      });
    });

    // Perform the sync
    await syncMissingMemories(userId, allActivities);

    // Get final counts
    const memoryCount = await Memory.countDocuments({ userId });

    res.status(200).json({
      success: true,
      message: "Memories synced successfully",
      data: {
        totalActivities: allActivities.length,
        memoriesInDatabase: memoryCount,
      },
    });
  } catch (error: unknown) {
    console.error("Sync memories error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

/**
 * Get user dashboard with comprehensive statistics
 * GET /memories/dashboard
 *
 * Returns:
 * - Total images/videos uploaded
 * - Total friends count
 * - Total chats count
 * - Total messages sent
 * - Recent activities (last 10)
 * - Activity breakdown by type
 */
export const getDashboard = async (
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

    // Fetch all counts in parallel for best performance
    const [
      totalFiles,
      totalImages,
      totalVideos,
      totalChats,
      totalMessagesSent,
      totalFriends,
      totalPendingRequests,
      recentFiles,
      recentChats,
      recentMessages,
      recentFriends,
    ] = await Promise.all([
      // Total files uploaded
      File.countDocuments({ userId }),

      // Total images uploaded
      File.countDocuments({ userId, fileType: "image" }),

      // Total videos uploaded
      File.countDocuments({ userId, fileType: "video" }),

      // Total chats created
      Chat.countDocuments({ userId }),

      // Total messages sent (user messages only)
      Message.countDocuments({ userId, senderType: "user" }),

      // Total accepted friends (where user is either sender or receiver)
      Friend.countDocuments({
        $or: [{ senderId: userId }, { receiverId: userId }],
        status: "accepted",
      }),

      // Pending friend requests received
      Friend.countDocuments({
        receiverId: userId,
        status: "pending",
      }),

      // Recent files (last 5)
      File.find({ userId })
        .sort({ uploadedAt: -1 })
        .limit(5)
        .select("fileName fileType fileUrl uploadedAt originalName")
        .lean(),

      // Recent chats (last 3)
      Chat.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(3)
        .select("createdAt updatedAt")
        .lean(),

      // Recent messages (last 5)
      Message.find({ userId, senderType: "user" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("text chatId createdAt")
        .lean(),

      // Recent friends (last 5)
      Friend.find({
        $or: [{ senderId: userId }, { receiverId: userId }],
        status: "accepted",
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("senderId", "username")
        .populate("receiverId", "username")
        .select("senderId receiverId updatedAt")
        .lean(),
    ]);

    // Build recent activities from all sources
    const recentActivities: any[] = [];

    // Add file uploads
    recentFiles.forEach((file: any) => {
      recentActivities.push({
        type: "file_upload",
        timestamp: file.uploadedAt || file.createdAt,
        data: {
          fileName: file.originalName || file.fileName,
          fileType: file.fileType,
          fileUrl: file.fileUrl,
        },
      });
    });

    // Add chat creation
    recentChats.forEach((chat: any) => {
      recentActivities.push({
        type: "chat_created",
        timestamp: chat.createdAt,
        data: {
          chatId: chat._id,
        },
      });
    });

    // Add messages
    recentMessages.forEach((message: any) => {
      recentActivities.push({
        type: "message_sent",
        timestamp: message.createdAt,
        data: {
          chatId: message.chatId,
          text: message.text.substring(0, 100),
        },
      });
    });

    // Add friends
    recentFriends.forEach((friend: any) => {
      const isSender = friend.senderId._id.toString() === userId;
      const friendUser = isSender ? friend.receiverId : friend.senderId;

      recentActivities.push({
        type: "friend_added",
        timestamp: friend.updatedAt,
        data: {
          friendUsername: friendUser.username,
          friendId: friendUser._id,
        },
      });
    });

    // Sort recent activities by timestamp and take top 10
    recentActivities.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    const topRecentActivities = recentActivities.slice(0, 10);

    // Build response
    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: {
        statistics: {
          files: {
            total: totalFiles,
            images: totalImages,
            videos: totalVideos,
          },
          friends: {
            total: totalFriends,
            pendingRequests: totalPendingRequests,
          },
          chats: {
            total: totalChats,
          },
          messages: {
            totalSent: totalMessagesSent,
          },
        },
        recentActivities: topRecentActivities,
        activityBreakdown: [
          { type: "file_upload", count: totalFiles },
          { type: "chat_created", count: totalChats },
          { type: "message_sent", count: totalMessagesSent },
          { type: "friends", count: totalFriends },
        ].filter((item) => item.count > 0), // Only include types with activity
      },
    });
  } catch (error: unknown) {
    console.error("Get dashboard error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

/**
 * Get activity statistics
 * GET /memories/stats
 *
 * Aggregates statistics from all sources (not just Memory model)
 */
export const getActivityStats = async (
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

    // Count activities from each source
    const [
      fileCount,
      chatCount,
      messageCount,
      friendRequestsSentCount,
      friendRequestsAcceptedCount,
      friendRequestsRejectedCount,
    ] = await Promise.all([
      File.countDocuments({ userId }),
      Chat.countDocuments({ userId }),
      Message.countDocuments({ userId, senderType: "user" }),
      Friend.countDocuments({ senderId: userId }),
      Friend.countDocuments({ receiverId: userId, status: "accepted" }),
      Friend.countDocuments({ receiverId: userId, status: "rejected" }),
    ]);

    // Build statistics array
    const byType = [];

    if (fileCount > 0) {
      byType.push({ activityType: "file_upload", count: fileCount });
    }
    if (chatCount > 0) {
      byType.push({ activityType: "chat_created", count: chatCount });
    }
    if (messageCount > 0) {
      byType.push({ activityType: "message_sent", count: messageCount });
    }
    if (friendRequestsSentCount > 0) {
      byType.push({
        activityType: "friend_request_sent",
        count: friendRequestsSentCount,
      });
    }
    if (friendRequestsAcceptedCount > 0) {
      byType.push({
        activityType: "friend_request_accepted",
        count: friendRequestsAcceptedCount,
      });
    }
    if (friendRequestsRejectedCount > 0) {
      byType.push({
        activityType: "friend_request_rejected",
        count: friendRequestsRejectedCount,
      });
    }

    const totalActivities =
      fileCount +
      chatCount +
      messageCount +
      friendRequestsSentCount +
      friendRequestsAcceptedCount +
      friendRequestsRejectedCount;

    res.status(200).json({
      success: true,
      message: "Activity statistics retrieved successfully",
      data: {
        total: totalActivities,
        byType,
      },
    });
  } catch (error: unknown) {
    console.error("Get activity stats error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};
