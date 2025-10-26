import mongoose, { Schema, Document } from "mongoose";

export interface IBlockedUser extends Document {
  userId: mongoose.Types.ObjectId;
  blockedUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const blockedUserSchema = new Schema<IBlockedUser>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique blocks and efficient lookups
blockedUserSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
blockedUserSchema.index({ blockedUserId: 1, userId: 1 });

export const BlockedUser = mongoose.model<IBlockedUser>(
  "BlockedUser",
  blockedUserSchema
);
