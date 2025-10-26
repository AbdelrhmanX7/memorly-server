import { Response } from "express";
import { Friend } from "../models/friend";
import { BlockedUser } from "../models/blocked-user";
import { User } from "../models/user";
import { handleError } from "../utils/handle-error";
import { AuthRequest } from "../types/express";
import { createMemory } from "../utils/memory.helper";

export const searchUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { username } = req.query;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    if (!username || typeof username !== "string") {
      handleError({
        res,
        error: new Error("Username query parameter is required"),
        statusCode: 400,
      });
      return;
    }

    // Search for users by username (case-insensitive, partial match)
    const users = await User.find(
      {
        username: { $regex: username, $options: "i" },
        _id: { $ne: userId }, // Exclude current user
      },
      { password: 0 } // Exclude password from results
    ).limit(20);

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: {
        users: users.map((user) => ({
          id: user._id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Search users error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const sendFriendRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { receiverId } = req.body;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    if (!receiverId) {
      handleError({
        res,
        error: new Error("receiverId is required"),
        statusCode: 400,
      });
      return;
    }

    // Check if user is trying to send request to themselves
    if (userId === receiverId) {
      handleError({
        res,
        error: new Error("Cannot send friend request to yourself"),
        statusCode: 400,
      });
      return;
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      handleError({
        res,
        error: new Error("User not found"),
        statusCode: 404,
      });
      return;
    }

    // Check if sender is blocked by receiver (due to previous rejection)
    const isBlocked = await BlockedUser.findOne({
      userId: receiverId,
      blockedUserId: userId,
    });

    if (isBlocked) {
      handleError({
        res,
        error: new Error("Cannot send friend request to this user"),
        statusCode: 403,
      });
      return;
    }

    // Check if a friend request already exists (in either direction)
    const existingRequest = await Friend.findOne({
      $or: [
        { senderId: userId, receiverId: receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    });

    if (existingRequest) {
      if (existingRequest.status === "accepted") {
        handleError({
          res,
          error: new Error("You are already friends with this user"),
          statusCode: 400,
        });
        return;
      }

      if (existingRequest.status === "pending") {
        handleError({
          res,
          error: new Error("Friend request already sent"),
          statusCode: 400,
        });
        return;
      }

      // If status is rejected, update it to pending for a new request
      if (existingRequest.status === "rejected") {
        existingRequest.status = "pending";
        existingRequest.senderId = userId as any;
        existingRequest.receiverId = receiverId;
        await existingRequest.save();

        res.status(200).json({
          success: true,
          message: "Friend request sent successfully",
          data: {
            friendRequest: {
              id: existingRequest._id,
              senderId: existingRequest.senderId,
              receiverId: existingRequest.receiverId,
              status: existingRequest.status,
              createdAt: existingRequest.createdAt,
            },
          },
        });
        return;
      }
    }

    // Create new friend request
    const friendRequest = new Friend({
      senderId: userId,
      receiverId: receiverId,
      status: "pending",
    });

    await friendRequest.save();

    // Create memory for friend request sent
    await createMemory({
      userId,
      activityType: "friend_request_sent",
      metadata: {
        friendRequestId: friendRequest._id as any,
        friendId: receiverId as any,
        friendUsername: receiver.username,
      },
    });

    res.status(201).json({
      success: true,
      message: "Friend request sent successfully",
      data: {
        friendRequest: {
          id: friendRequest._id,
          senderId: friendRequest.senderId,
          receiverId: friendRequest.receiverId,
          status: friendRequest.status,
          createdAt: friendRequest.createdAt,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Send friend request error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const acceptFriendRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { requestId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Find the friend request
    const friendRequest = await Friend.findOne({
      _id: requestId,
      receiverId: userId,
      status: "pending",
    });

    if (!friendRequest) {
      handleError({
        res,
        error: new Error("Friend request not found"),
        statusCode: 404,
      });
      return;
    }

    // Update status to accepted
    friendRequest.status = "accepted";
    await friendRequest.save();

    // Get sender info for memory
    const sender = await User.findById(friendRequest.senderId, "username");

    // Create memory for friend request accepted
    if (sender) {
      await createMemory({
        userId,
        activityType: "friend_request_accepted",
        metadata: {
          friendRequestId: friendRequest._id as any,
          friendId: friendRequest.senderId as any,
          friendUsername: sender.username,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Friend request accepted",
      data: {
        friendRequest: {
          id: friendRequest._id,
          senderId: friendRequest.senderId,
          receiverId: friendRequest.receiverId,
          status: friendRequest.status,
          updatedAt: friendRequest.updatedAt,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Accept friend request error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const rejectFriendRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { requestId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Find the friend request
    const friendRequest = await Friend.findOne({
      _id: requestId,
      receiverId: userId,
      status: "pending",
    });

    if (!friendRequest) {
      handleError({
        res,
        error: new Error("Friend request not found"),
        statusCode: 404,
      });
      return;
    }

    // Update status to rejected
    friendRequest.status = "rejected";
    await friendRequest.save();

    // Get sender info for memory
    const sender = await User.findById(friendRequest.senderId, "username");

    // Create memory for friend request rejected
    if (sender) {
      await createMemory({
        userId,
        activityType: "friend_request_rejected",
        metadata: {
          friendRequestId: friendRequest._id as any,
          friendId: friendRequest.senderId as any,
          friendUsername: sender.username,
        },
      });
    }

    // Add sender to blocked users list to prevent future requests
    try {
      await BlockedUser.create({
        userId: userId,
        blockedUserId: friendRequest.senderId,
      });
    } catch (error: any) {
      // Ignore duplicate key errors (already blocked)
      if (error.code !== 11000) {
        throw error;
      }
    }

    res.status(200).json({
      success: true,
      message: "Friend request rejected",
      data: {
        friendRequest: {
          id: friendRequest._id,
          senderId: friendRequest.senderId,
          receiverId: friendRequest.receiverId,
          status: friendRequest.status,
          updatedAt: friendRequest.updatedAt,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Reject friend request error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const getPendingRequests = async (
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

    // Get all pending friend requests where user is the receiver
    const pendingRequests = await Friend.find({
      receiverId: userId,
      status: "pending",
    })
      .populate("senderId", "username email isVerified")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Pending friend requests retrieved successfully",
      data: {
        requests: pendingRequests.map((request) => ({
          id: request._id,
          sender: request.senderId,
          status: request.status,
          createdAt: request.createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Get pending requests error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const getFriendsList = async (
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

    // Get all accepted friend relationships where user is either sender or receiver
    const friends = await Friend.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: "accepted",
    })
      .populate("senderId", "username email isVerified")
      .populate("receiverId", "username email isVerified")
      .sort({ updatedAt: -1 });

    // Extract the friend user (the one that is not the current user)
    const friendsList = friends.map((friend) => {
      const isSender = friend.senderId._id.toString() === userId;
      const friendUser = isSender ? friend.receiverId : friend.senderId;

      return {
        id: friend._id,
        friend: friendUser,
        friendsSince: friend.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      message: "Friends list retrieved successfully",
      data: {
        friends: friendsList,
      },
    });
  } catch (error: unknown) {
    console.error("Get friends list error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const removeFriend = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { friendId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    // Find and delete the friendship
    const friendship = await Friend.findOneAndDelete({
      $or: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
      status: "accepted",
    });

    if (!friendship) {
      handleError({
        res,
        error: new Error("Friendship not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Friend removed successfully",
      data: null,
    });
  } catch (error: unknown) {
    console.error("Remove friend error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const getBlockedUsers = async (
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

    const blockedUsers = await BlockedUser.find({ userId })
      .populate("blockedUserId", "username email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Blocked users retrieved successfully",
      data: {
        blockedUsers: blockedUsers.map((block) => ({
          id: block._id,
          blockedUser: block.blockedUserId,
          blockedAt: block.createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Get blocked users error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const unblockUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { blockedUserId } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("User not authenticated"),
        statusCode: 401,
      });
      return;
    }

    const blockedUser = await BlockedUser.findOneAndDelete({
      userId,
      blockedUserId,
    });

    if (!blockedUser) {
      handleError({
        res,
        error: new Error("Blocked user not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
      data: null,
    });
  } catch (error: unknown) {
    console.error("Unblock user error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};
