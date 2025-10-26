import { Request, Response } from "express";
import {
  initiateChunkedUpload,
  uploadChunk,
  completeChunkedUpload,
  abortChunkedUpload,
  getUploadStatus,
  CHUNK_SIZE,
} from "../utils/chunk-upload.service";
import { File } from "../models/file";
import { handleError } from "../utils/handle-error";

/**
 * Initiate a chunked upload session
 * POST {API}files/chunk/initiate
 */
export const initiateUpload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const { originalName, mimeType, totalSize, totalChunks } = req.body;

    // Validate input
    if (!originalName || !mimeType || !totalSize || !totalChunks) {
      handleError({
        res,
        error: new Error(
          "Missing required fields: originalName, mimeType, totalSize, totalChunks"
        ),
        statusCode: 400,
      });
      return;
    }

    if (typeof totalSize !== "number" || totalSize <= 0) {
      handleError({
        res,
        error: new Error("totalSize must be a positive number"),
        statusCode: 400,
      });
      return;
    }

    if (typeof totalChunks !== "number" || totalChunks <= 0) {
      handleError({
        res,
        error: new Error("totalChunks must be a positive number"),
        statusCode: 400,
      });
      return;
    }

    // Initiate upload
    const result = await initiateChunkedUpload({
      userId,
      originalName,
      mimeType,
      totalSize,
      totalChunks,
    });

    res.status(201).json({
      success: true,
      message: "Chunked upload initiated successfully",
      data: result,
    });
  } catch (error: unknown) {
    console.error("Initiate upload error:", error);
    handleError({
      res,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to initiate chunked upload"),
      statusCode: 500,
    });
  }
};

/**
 * Upload a chunk
 * POST {API}files/chunk/upload
 */
export const uploadChunkHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const { uploadId, partNumber } = req.body;

    if (!uploadId || !partNumber) {
      handleError({
        res,
        error: new Error("Missing required fields: uploadId, partNumber"),
        statusCode: 400,
      });
      return;
    }

    if (!req.file) {
      handleError({
        res,
        error: new Error("No chunk data provided"),
        statusCode: 400,
      });
      return;
    }

    const partNum = parseInt(partNumber, 10);

    if (isNaN(partNum) || partNum < 1) {
      handleError({
        res,
        error: new Error("partNumber must be a positive integer"),
        statusCode: 400,
      });
      return;
    }

    // Upload the chunk
    const result = await uploadChunk({
      uploadId,
      partNumber: partNum,
      chunk: req.file.buffer,
    });

    res.status(200).json({
      success: true,
      message: "Chunk uploaded successfully",
      data: result,
    });
  } catch (error: unknown) {
    console.error("Upload chunk error:", error);
    handleError({
      res,
      error:
        error instanceof Error ? error : new Error("Failed to upload chunk"),
      statusCode: 500,
    });
  }
};

/**
 * Complete chunked upload
 * POST {API}files/chunk/complete
 */
export const completeUpload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const { uploadId } = req.body;

    if (!uploadId) {
      handleError({
        res,
        error: new Error("Missing required field: uploadId"),
        statusCode: 400,
      });
      return;
    }

    // Complete the upload
    const result = await completeChunkedUpload({ uploadId, userId });

    // Get the upload session to retrieve metadata
    const uploadStatus = await getUploadStatus(uploadId, userId);

    // Save file metadata to database
    const newFile = await File.create({
      userId,
      fileName: result.fileName,
      originalName: uploadStatus.originalName,
      mimeType: uploadStatus.fileName.endsWith(".mp4")
        ? "video/mp4"
        : uploadStatus.fileName.endsWith(".webm")
          ? "video/webm"
          : "video/mp4",
      fileType: "video",
      fileSize: result.fileSize,
      fileUrl: result.fileUrl,
      fileId: result.fileId,
      bucketName: result.bucketName,
    });

    res.status(200).json({
      success: true,
      message: "Upload completed successfully",
      data: {
        id: newFile._id,
        fileName: newFile.fileName,
        originalName: newFile.originalName,
        fileType: newFile.fileType,
        fileSize: newFile.fileSize,
        fileUrl: newFile.fileUrl,
        uploadedAt: newFile.uploadedAt,
      },
    });
  } catch (error: unknown) {
    console.error("Complete upload error:", error);
    handleError({
      res,
      error:
        error instanceof Error ? error : new Error("Failed to complete upload"),
      statusCode: 500,
    });
  }
};

/**
 * Abort chunked upload
 * POST {API}files/chunk/abort
 */
export const abortUpload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const { uploadId } = req.body;

    if (!uploadId) {
      handleError({
        res,
        error: new Error("Missing required field: uploadId"),
        statusCode: 400,
      });
      return;
    }

    await abortChunkedUpload(uploadId, userId);

    res.status(200).json({
      success: true,
      message: "Upload aborted successfully",
    });
  } catch (error: unknown) {
    console.error("Abort upload error:", error);
    handleError({
      res,
      error:
        error instanceof Error ? error : new Error("Failed to abort upload"),
      statusCode: 500,
    });
  }
};

/**
 * Get upload status
 * GET {API}files/chunk/status/:uploadId
 */
export const getUploadStatusHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const { uploadId } = req.params;

    if (!uploadId) {
      handleError({
        res,
        error: new Error("Missing required parameter: uploadId"),
        statusCode: 400,
      });
      return;
    }

    const status = await getUploadStatus(uploadId, userId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: unknown) {
    console.error("Get upload status error:", error);
    handleError({
      res,
      error:
        error instanceof Error
          ? error
          : new Error("Failed to get upload status"),
      statusCode: 500,
    });
  }
};
