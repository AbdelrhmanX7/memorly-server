import multer from "multer";

// Use memory storage to store files in buffer
const storage = multer.memoryStorage();

// File filter for images and videos
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Videos
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only images (JPEG, PNG, GIF, WebP, SVG) and videos (MP4, MPEG, QuickTime, AVI, WebM) are allowed."
      )
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size for regular uploads
  },
});

// Separate upload handler for chunked uploads (no file filter needed as validation happens in controller)
export const chunkUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per chunk (allowing for 5MB chunks with overhead)
  },
});
