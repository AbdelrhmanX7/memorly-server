import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFile extends Document {
  userId: Types.ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileType: "image" | "video";
  fileSize: number;
  fileUrl: string;
  fileId: string; // Backblaze B2 file ID
  bucketName: string;
  uploadedAt: Date;
}

const fileSchema = new Schema<IFile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileId: {
      type: String,
      required: true,
    },
    bucketName: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
fileSchema.index({ userId: 1, fileType: 1 });
fileSchema.index({ userId: 1, uploadedAt: -1 });

export const File = mongoose.model<IFile>("File", fileSchema);
