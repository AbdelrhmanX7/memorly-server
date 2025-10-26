import mongoose, { Schema, Document } from "mongoose";

export interface IFriend extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const friendSchema = new Schema<IFriend>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique friend requests between two users
friendSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

// Index for efficient status queries
friendSchema.index({ receiverId: 1, status: 1 });
friendSchema.index({ senderId: 1, status: 1 });

export const Friend = mongoose.model<IFriend>("Friend", friendSchema);
