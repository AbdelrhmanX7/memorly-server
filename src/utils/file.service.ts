import { getB2 } from "../config/backblaze";
import crypto from "crypto";
import path from "path";

interface UploadResult {
  fileId: string;
  fileName: string;
  fileUrl: string;
  bucketName: string;
}

export const uploadToB2 = async (
  file: Express.Multer.File,
  userId: string
): Promise<UploadResult> => {
  const b2 = getB2();
  const bucketName = process.env.B2_BUCKET_NAME || "";

  // Generate unique filename
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(file.originalname);
  const fileName = `${userId}/${timestamp}-${randomString}${ext}`;

  try {
    // Get upload URL
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID || "",
    });

    // Upload file
    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: fileName,
      data: file.buffer,
      mime: file.mimetype,
    });

    // Construct file URL
    const fileUrl = `${process.env.B2_DOWNLOAD_URL}/${bucketName}/${fileName}`;

    return {
      fileId: uploadResponse.data.fileId,
      fileName: fileName,
      fileUrl: fileUrl,
      bucketName: bucketName,
    };
  } catch (error) {
    console.error("Error uploading to B2:", error);
    throw new Error("Failed to upload file to Backblaze B2");
  }
};

export const deleteFromB2 = async (
  fileId: string,
  fileName: string
): Promise<void> => {
  const b2 = getB2();

  try {
    await b2.deleteFileVersion({
      fileId: fileId,
      fileName: fileName,
    });
  } catch (error) {
    console.error("Error deleting from B2:", error);
    throw new Error("Failed to delete file from Backblaze B2");
  }
};

export const getAllowedMimeTypes = (): {
  image: string[];
  video: string[];
} => {
  return {
    image: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
    video: [
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ],
  };
};

export const getFileType = (
  mimeType: string
): "image" | "video" | "unknown" => {
  const allowedTypes = getAllowedMimeTypes();

  if (allowedTypes.image.includes(mimeType)) {
    return "image";
  }
  if (allowedTypes.video.includes(mimeType)) {
    return "video";
  }
  return "unknown";
};

export const validateFileType = (mimeType: string): boolean => {
  const fileType = getFileType(mimeType);
  return fileType !== "unknown";
};

export const getMaxFileSize = (fileType: "image" | "video"): number => {
  // Return size in bytes
  if (fileType === "image") {
    return 10 * 1024 * 1024; // 10MB for images
  }
  if (fileType === "video") {
    return 100 * 1024 * 1024; // 100MB for videos
  }
  return 0;
};
