import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, getB2Config } from "../config/backblaze";
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
  const { bucketName } = getB2Config();

  // Generate unique filename
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(file.originalname);
  const fileName = `files/${userId}/${timestamp}-${randomString}${ext}`;

  try {
    // Determine content type based on file extension
    const fileExtension = ext.toLowerCase();
    let contentType = file.mimetype;

    // Override content type for specific extensions if needed
    switch (fileExtension) {
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".mp4":
        contentType = "video/mp4";
        break;
      case ".webm":
        contentType = "video/webm";
        break;
    }

    // Upload to B2 using S3 SDK
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000", // 1 year cache
      Metadata: {
        userId: userId,
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Construct public URL
    const b2Endpoint = process.env.B2_ENDPOINT || "";
    const fileUrl = `${b2Endpoint}/${bucketName}/${fileName}`;

    return {
      fileId: fileName, // Use the S3 key as fileId
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
  _fileId: string,
  fileName: string
): Promise<void> => {
  const { bucketName } = getB2Config();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileName, // Use fileName (which is the S3 key)
    });

    await s3Client.send(command);
    console.log(`🗑️ File deleted from B2: ${fileName}`);
  } catch (error) {
    console.error("Error deleting from B2:", error);
    // Don't throw error for deletion failures - just log them
    console.warn(
      "Failed to delete file from B2, but continuing with local cleanup"
    );
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
    return 100 * 1024 * 1024; // 100MB for regular uploads (use chunked upload for larger files)
  }
  return 0;
};

export const getMaxChunkedVideoSize = (): number => {
  return 10 * 1024 * 1024 * 1024; // 10GB for chunked uploads
};
