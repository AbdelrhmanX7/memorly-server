import mongoose, { Schema, Document } from "mongoose";

export interface IMemory extends Document {
  userId: mongoose.Types.ObjectId;
  activityType:
    | "file_upload"
    | "chat_created"
    | "message_sent"
    | "friend_request_sent"
    | "friend_request_accepted"
    | "friend_request_rejected";
  metadata: {
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
  createdAt: Date;
  updatedAt: Date;
}

const memorySchema = new Schema<IMemory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    activityType: {
      type: String,
      enum: [
        "file_upload",
        "chat_created",
        "message_sent",
        "friend_request_sent",
        "friend_request_accepted",
        "friend_request_rejected",
      ],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound index for efficient timeline queries sorted by date
memorySchema.index({ userId: 1, createdAt: -1 });

// Index for filtering by activity type
memorySchema.index({ userId: 1, activityType: 1, createdAt: -1 });

export const Memory = mongoose.model<IMemory>("Memory", memorySchema);
