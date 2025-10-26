import { Request, Response } from "express";
import { File } from "../models/file";
import { Location } from "../models/location";
import {
  uploadToB2,
  deleteFromB2,
  validateFileType,
  getFileType,
  getMaxFileSize,
} from "../utils/file.service";
import { handleError } from "../utils/handle-error";
import { extractImageTimestamp } from "../utils/exif.helper";
import { createMemory } from "../utils/memory.helper";
import axios from "axios";
import FormData from "form-data";

async function sendImage({ api, userId, media_id, timestamp, file, location }: {
  api: string;
  userId: string;
  media_id: string;
  timestamp: number | Date;
  file: {
    buffer: Buffer;
    originalname?: string;
    mimetype?: string;
  };
  location?: string;
}) {
  // file: { buffer, originalname?, mimetype? }  // from multer memoryStorage
  const form = new FormData();

  // Attach the binary file (don't base64 it)
  form.append("file", file.buffer, {
    filename: file.originalname || `upload-${Date.now()}`,
    contentType: file.mimetype || "application/octet-stream",
  });

  // Regular form fields (strings in multipart)
  form.append("user_id", String(userId));
  form.append("media_id", String(media_id));
  form.append(
    "timestamp",
    String(
      Number.isInteger(timestamp)
        ? timestamp // already seconds
        : Math.floor(new Date(timestamp).getTime() / 1000) // Date → seconds
    )
  );
  if (location) form.append("location", location);

  const response = await axios.post(`${api}/process/image`, form, {
    headers: form.getHeaders(),      // lets axios set the multipart boundary
    timeout: 300_000,                // 300s to match your Python example
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return response.data;
}

async function sendVideo({ api, userId, media_id, timestamp, file, location }: {
  api: string;
  userId: string;
  media_id: string;
  timestamp: number | Date;
  file: {
    buffer: Buffer;
    originalname?: string;
    mimetype?: string;
  };
  location?: string;
}) {
  // file: { buffer, originalname?, mimetype? }  // from multer memoryStorage
  const form = new FormData();

  // Attach the binary file (don't base64 it)
  form.append("file", file.buffer, {
    filename: file.originalname || `upload-${Date.now()}`,
    contentType: file.mimetype || "application/octet-stream",
  });

  // Regular form fields (strings in multipart)
  form.append("user_id", String(userId));
  form.append("media_id", String(media_id));
  form.append(
    "timestamp",
    String(
      Number.isInteger(timestamp)
        ? timestamp // already seconds
        : Math.floor(new Date(timestamp).getTime() / 1000) // Date → seconds
    )
  );
  if (location) form.append("location", location);

  const response = await axios.post(`${api}/process/video`, form, {
    headers: form.getHeaders(),      // lets axios set the multipart boundary
    timeout: 300_000,                // 300s to match your Python example
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return response.data;
}

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
    const { location } = req.body; // Get location from request body

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

    // Extract timestamp from EXIF data for images
    let timestamp: Date | null = null;
    if (fileType === "image" && file.buffer) {
      timestamp = extractImageTimestamp(file.buffer);
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
      location: location || null, // Use provided location or null
      timestamp: timestamp || new Date(), // Use EXIF timestamp or current time
    });

    // Save location to Location model if provided
    if (location) {
      try {
        await Location.create({ userId, location });
      } catch (error) {
        console.error("Error saving location:", error);
        // Continue even if location save fails
      }
    }

    // Create memory entry
    await createMemory({
      userId,
      activityType: "file_upload",
      metadata: {
        fileId: newFile._id as any,
        fileName: newFile.originalName,
        fileType: newFile.fileType,
        fileUrl: newFile.fileUrl,
        fileSize: newFile.fileSize,
        mimeType: newFile.mimeType,
        location: newFile.location,
        timestamp: newFile.timestamp,
      },
    });

    const api = process.env.MEMORLY_INTERNAL_TOOLS_API || "http://localhost:9000"

    try {
      console.log("Sending file to internal tools API:", {
        user_id: userId,
        media_id: newFile._id,
        file_size: newFile.fileSize,
        file_type: newFile.fileType,
        timestamp: newFile.timestamp,
        location: newFile.location,
      });

      const endpoint = fileType === "image" ? "/process/image" : "/process/video";
      console.log(`API Endpoint: ${api}${endpoint}`);

      const response = fileType === "image"
        ? await sendImage({
            api,
            userId,
            media_id: newFile._id as any,
            timestamp: newFile.timestamp as any,
            file,
            location: newFile.location || "",
          })
        : await sendVideo({
            api,
            userId,
            media_id: newFile._id as any,
            timestamp: newFile.timestamp as any,
            file,
            location: newFile.location || "",
          });

      console.log("Internal tools API response:", response);

    } catch (error) {
      console.error("Error sending file to internal tools API:", error);
    }

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
        location: newFile.location,
        timestamp: newFile.timestamp,
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
