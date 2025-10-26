import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChunkUpload extends Document {
  userId: Types.ObjectId;
  uploadId: string; // S3 multipart upload ID
  fileName: string;
  originalName: string;
  mimeType: string;
  fileType: "video"; // Only videos need chunked uploads
  totalSize: number;
  totalChunks: number;
  uploadedChunks: number;
  parts: Array<{
    partNumber: number;
    eTag: string;
    size: number;
  }>;
  status: "initiated" | "uploading" | "completed" | "failed" | "aborted";
  location: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chunkUploadSchema = new Schema<IChunkUpload>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploadId: {
      type: String,
      required: true,
      unique: true, // Creates index automatically
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
      enum: ["video"],
      required: true,
      default: "video",
    },
    totalSize: {
      type: Number,
      required: true,
      min: 0,
    },
    totalChunks: {
      type: Number,
      required: true,
      min: 1,
    },
    uploadedChunks: {
      type: Number,
      default: 0,
      min: 0,
    },
    parts: [
      {
        partNumber: {
          type: Number,
          required: true,
        },
        eTag: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["initiated", "uploading", "completed", "failed", "aborted"],
      default: "initiated",
      required: true,
    },
    location: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true, // Creates index automatically
    },
  },
  { timestamps: true }
);

// Composite index for efficient queries (individual indexes created via schema fields above)
chunkUploadSchema.index({ userId: 1, status: 1 });

export const ChunkUpload = mongoose.model<IChunkUpload>(
  "ChunkUpload",
  chunkUploadSchema
);
