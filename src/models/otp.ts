import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOtp extends Document {
  userId: Types.ObjectId;
  email: string;
  otp: string;
  type: "email_verification" | "password_reset";
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["email_verification", "password_reset"],
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Document will be automatically deleted after 10 minutes (TTL index)
  },
});

// Index for faster queries
otpSchema.index({ userId: 1, type: 1 });
otpSchema.index({ email: 1, type: 1 });
otpSchema.index({ expiresAt: 1 });

export const Otp = mongoose.model<IOtp>("Otp", otpSchema);
