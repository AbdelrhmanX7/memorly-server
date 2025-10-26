import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  userId: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  text: string;
  senderType: "user" | "system";
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    senderType: {
      type: String,
      enum: ["user", "system"],
      required: true,
    },
  },
  { timestamps: true }
);

// Index for efficient chat message retrieval
messageSchema.index({ chatId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
