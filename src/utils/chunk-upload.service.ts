import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { s3Client, getB2Config } from "../config/backblaze";
import { ChunkUpload } from "../models/chunk-upload";
import crypto from "crypto";
import path from "path";

interface InitiateUploadParams {
  userId: string;
  originalName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
}

interface InitiateUploadResult {
  uploadId: string;
  fileName: string;
  chunkSize: number;
}

interface UploadChunkParams {
  uploadId: string;
  partNumber: number;
  chunk: Buffer;
}

interface UploadChunkResult {
  partNumber: number;
  eTag: string;
  uploadedChunks: number;
  totalChunks: number;
}

interface CompleteUploadParams {
  uploadId: string;
  userId: string;
}

interface CompleteUploadResult {
  fileId: string;
  fileName: string;
  fileUrl: string;
  bucketName: string;
  fileSize: number;
}

// Standard chunk size: 5MB (S3 minimum for multipart except last part)
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

/**
 * Initiate a chunked upload session
 */
export const initiateChunkedUpload = async (
  params: InitiateUploadParams
): Promise<InitiateUploadResult> => {
  const { userId, originalName, mimeType, totalSize, totalChunks } = params;
  const { bucketName } = getB2Config();

  // Validate video MIME type
  const allowedVideoTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ];

  if (!allowedVideoTypes.includes(mimeType)) {
    throw new Error(
      "Invalid file type. Only video files are supported for chunked upload."
    );
  }

  // Validate file size
  if (totalSize > MAX_VIDEO_SIZE) {
    throw new Error(`File size exceeds maximum limit of 10GB`);
  }

  if (totalSize < CHUNK_SIZE && totalChunks > 1) {
    throw new Error(
      "Files smaller than 5MB should use regular upload, not chunked upload"
    );
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(originalName);
    const fileName = `files/${userId}/${timestamp}-${randomString}${ext}`;

    // Determine content type
    let contentType = mimeType;
    const fileExtension = ext.toLowerCase();

    switch (fileExtension) {
      case ".mp4":
        contentType = "video/mp4";
        break;
      case ".webm":
        contentType = "video/webm";
        break;
      case ".mov":
        contentType = "video/quicktime";
        break;
      case ".avi":
        contentType = "video/x-msvideo";
        break;
    }

    // Create multipart upload in B2
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000", // 1 year cache
      Metadata: {
        userId: userId,
        originalName: originalName,
        uploadedAt: new Date().toISOString(),
        totalSize: totalSize.toString(),
      },
    });

    const multipartUpload = await s3Client.send(createCommand);

    if (!multipartUpload.UploadId) {
      throw new Error("Failed to initiate multipart upload");
    }

    // Save upload session to database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    await ChunkUpload.create({
      userId,
      uploadId: multipartUpload.UploadId,
      fileName,
      originalName,
      mimeType: contentType,
      fileType: "video",
      totalSize,
      totalChunks,
      uploadedChunks: 0,
      parts: [],
      status: "initiated",
      expiresAt,
    });

    return {
      uploadId: multipartUpload.UploadId,
      fileName,
      chunkSize: CHUNK_SIZE,
    };
  } catch (error) {
    console.error("Error initiating chunked upload:", error);
    throw new Error("Failed to initiate chunked upload");
  }
};

/**
 * Upload a single chunk
 */
export const uploadChunk = async (
  params: UploadChunkParams
): Promise<UploadChunkResult> => {
  const { uploadId, partNumber, chunk } = params;
  const { bucketName } = getB2Config();

  try {
    // Get upload session from database
    const uploadSession = await ChunkUpload.findOne({ uploadId });

    if (!uploadSession) {
      throw new Error("Upload session not found");
    }

    if (uploadSession.status === "completed") {
      throw new Error("Upload session already completed");
    }

    if (uploadSession.status === "aborted" || uploadSession.status === "failed") {
      throw new Error("Upload session has been aborted or failed");
    }

    // Check if chunk already uploaded
    const existingPart = uploadSession.parts.find(
      (p) => p.partNumber === partNumber
    );
    if (existingPart) {
      return {
        partNumber,
        eTag: existingPart.eTag,
        uploadedChunks: uploadSession.uploadedChunks,
        totalChunks: uploadSession.totalChunks,
      };
    }

    // Upload part to B2
    const uploadPartCommand = new UploadPartCommand({
      Bucket: bucketName,
      Key: uploadSession.fileName,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: chunk,
    });

    const uploadResult = await s3Client.send(uploadPartCommand);

    if (!uploadResult.ETag) {
      throw new Error("Failed to upload chunk - no ETag returned");
    }

    // Update upload session
    uploadSession.parts.push({
      partNumber,
      eTag: uploadResult.ETag,
      size: chunk.length,
    });
    uploadSession.uploadedChunks += 1;
    uploadSession.status = "uploading";
    await uploadSession.save();

    return {
      partNumber,
      eTag: uploadResult.ETag,
      uploadedChunks: uploadSession.uploadedChunks,
      totalChunks: uploadSession.totalChunks,
    };
  } catch (error) {
    console.error("Error uploading chunk:", error);
    throw new Error("Failed to upload chunk");
  }
};

/**
 * Complete the chunked upload
 */
export const completeChunkedUpload = async (
  params: CompleteUploadParams
): Promise<CompleteUploadResult> => {
  const { uploadId, userId } = params;
  const { bucketName } = getB2Config();

  try {
    // Get upload session from database
    const uploadSession = await ChunkUpload.findOne({ uploadId, userId });

    if (!uploadSession) {
      throw new Error("Upload session not found");
    }

    if (uploadSession.status === "completed") {
      throw new Error("Upload already completed");
    }

    // Verify all chunks are uploaded
    if (uploadSession.uploadedChunks !== uploadSession.totalChunks) {
      throw new Error(
        `Not all chunks uploaded. Expected ${uploadSession.totalChunks}, got ${uploadSession.uploadedChunks}`
      );
    }

    // Sort parts by part number
    const sortedParts = uploadSession.parts.sort(
      (a, b) => a.partNumber - b.partNumber
    );

    // Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: uploadSession.fileName,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.eTag,
        })),
      },
    });

    await s3Client.send(completeCommand);

    // Mark upload as completed
    uploadSession.status = "completed";
    await uploadSession.save();

    // Construct public URL
    const b2Endpoint = process.env.B2_ENDPOINT || "";
    const fileUrl = `${b2Endpoint}/${bucketName}/${uploadSession.fileName}`;

    return {
      fileId: uploadSession.fileName,
      fileName: uploadSession.fileName,
      fileUrl,
      bucketName,
      fileSize: uploadSession.totalSize,
    };
  } catch (error) {
    console.error("Error completing chunked upload:", error);
    throw new Error("Failed to complete chunked upload");
  }
};

/**
 * Abort a chunked upload session
 */
export const abortChunkedUpload = async (
  uploadId: string,
  userId: string
): Promise<void> => {
  const { bucketName } = getB2Config();

  try {
    const uploadSession = await ChunkUpload.findOne({ uploadId, userId });

    if (!uploadSession) {
      throw new Error("Upload session not found");
    }

    // Abort multipart upload in B2
    const abortCommand = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: uploadSession.fileName,
      UploadId: uploadId,
    });

    await s3Client.send(abortCommand);

    // Mark upload as aborted
    uploadSession.status = "aborted";
    await uploadSession.save();

    console.log(`Chunked upload aborted: ${uploadId}`);
  } catch (error) {
    console.error("Error aborting chunked upload:", error);
    throw new Error("Failed to abort chunked upload");
  }
};

/**
 * Get upload session status
 */
export const getUploadStatus = async (uploadId: string, userId: string) => {
  const uploadSession = await ChunkUpload.findOne({ uploadId, userId });

  if (!uploadSession) {
    throw new Error("Upload session not found");
  }

  return {
    uploadId: uploadSession.uploadId,
    fileName: uploadSession.fileName,
    originalName: uploadSession.originalName,
    totalSize: uploadSession.totalSize,
    totalChunks: uploadSession.totalChunks,
    uploadedChunks: uploadSession.uploadedChunks,
    status: uploadSession.status,
    parts: uploadSession.parts.map((p) => ({
      partNumber: p.partNumber,
      size: p.size,
    })),
    expiresAt: uploadSession.expiresAt,
  };
};

/**
 * Clean up expired upload sessions
 */
export const cleanupExpiredUploads = async (): Promise<number> => {
  const { bucketName } = getB2Config();
  let cleanedCount = 0;

  try {
    // Find expired uploads that are not completed
    const expiredUploads = await ChunkUpload.find({
      expiresAt: { $lt: new Date() },
      status: { $in: ["initiated", "uploading"] },
    });

    for (const upload of expiredUploads) {
      try {
        // Abort multipart upload in B2
        const abortCommand = new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: upload.fileName,
          UploadId: upload.uploadId,
        });

        await s3Client.send(abortCommand);

        // Delete from database
        await ChunkUpload.deleteOne({ _id: upload._id });
        cleanedCount++;
      } catch (error) {
        console.error(`Failed to cleanup upload ${upload.uploadId}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired uploads`);
    }

    return cleanedCount;
  } catch (error) {
    console.error("Error cleaning up expired uploads:", error);
    return cleanedCount;
  }
};
