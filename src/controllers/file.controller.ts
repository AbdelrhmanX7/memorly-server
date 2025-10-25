import { Request, Response } from "express";
import { File } from "../models/file";
import {
  uploadToB2,
  deleteFromB2,
  validateFileType,
  getFileType,
  getMaxFileSize,
} from "../utils/file.service";
import { handleError } from "../utils/handle-error";

export const uploadFile = async (
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

    if (!req.file) {
      handleError({
        res,
        error: new Error("No file uploaded"),
        statusCode: 400,
      });
      return;
    }

    const file = req.file;

    // Validate file type
    if (!validateFileType(file.mimetype)) {
      handleError({
        res,
        error: new Error(
          "Invalid file type. Only images and videos are allowed."
        ),
        statusCode: 400,
      });
      return;
    }

    const fileType = getFileType(file.mimetype);

    if (fileType === "unknown") {
      handleError({
        res,
        error: new Error("Unsupported file type. Only images and videos are allowed."),
      });
      return;
    }

    const maxSize = getMaxFileSize(fileType);

    // Validate file size
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      handleError({
        res,
        error: new Error(
          `File size exceeds ${maxSizeMB}MB limit for ${fileType}s`
        ),
        statusCode: 400,
      });
      return;
    }

    // Upload to Backblaze B2
    const uploadResult = await uploadToB2(file, userId);

    // Save file metadata to database
    const newFile = await File.create({
      userId,
      fileName: uploadResult.fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType,
      fileSize: file.size,
      fileUrl: uploadResult.fileUrl,
      fileId: uploadResult.fileId,
      bucketName: uploadResult.bucketName,
    });

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
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
    console.error("File upload error:", error);
    handleError({
      res,
      error:
        error instanceof Error ? error : new Error("Failed to upload file"),
      statusCode: 500,
    });
  }
};

export const getUserFiles = async (
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

    const { type, page = 1, limit = 20 } = req.query;

    const query: Record<string, unknown> = { userId };

    if (type && (type === "image" || type === "video")) {
      query.fileType = type;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const files = await File.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select("-fileId -bucketName");

    const total = await File.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        files,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: unknown) {
    console.error("Get user files error:", error);
    handleError({
      res,
      error:
        error instanceof Error ? error : new Error("Failed to fetch files"),
      statusCode: 500,
    });
  }
};

export const getFileById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const file = await File.findOne({ _id: id, userId }).select(
      "-fileId -bucketName"
    );

    if (!file) {
      handleError({
        res,
        error: new Error("File not found"),
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: file,
    });
  } catch (error: unknown) {
    console.error("Get file error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Failed to get file"),
      statusCode: 500,
    });
  }
};

export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      handleError({
        res,
        error: new Error("Unauthorized"),
        statusCode: 401,
      });
      return;
    }

    const file = await File.findOne({ _id: id, userId });

    if (!file) {
      handleError({
        res,
        error: new Error("File not found"),
        statusCode: 404,
      });
      return;
    }

    // Delete from Backblaze B2
    await deleteFromB2(file.fileId, file.fileName);

    // Delete from database
    await File.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error: unknown) {
    console.error("Delete file error:", error);
    handleError({
      res,
      error:
        error instanceof Error ? error : new Error("Failed to delete file"),
      statusCode: 500,
    });
  }
};
