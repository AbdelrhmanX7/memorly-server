# Chunked Video Upload Guide

This guide explains how to use the chunked upload feature for uploading large video files (up to 10GB) to Memorly.

## Overview

The chunked upload feature uses AWS S3's multipart upload protocol (compatible with Backblaze B2) to handle large video files that exceed the standard 100MB limit. Videos are split into chunks of 5MB each and uploaded sequentially.

## Features

- **Large file support**: Upload videos up to 10GB
- **Resumable uploads**: Track upload progress and resume if interrupted
- **Automatic cleanup**: Expired uploads (24+ hours old) are automatically cleaned up
- **Progress tracking**: Monitor upload progress in real-time

## API Endpoints

All endpoints require authentication via Bearer token.

### 1. Initiate Upload

**POST** `{API}/files/chunk/initiate`

Start a new chunked upload session.

**Request Body:**

```json
{
  "originalName": "my-video.mp4",
  "mimeType": "video/mp4",
  "totalSize": 524288000,
  "totalChunks": 100
}
```

**Response:**

```json
{
  "success": true,
  "message": "Chunked upload initiated successfully",
  "data": {
    "uploadId": "unique-upload-id",
    "fileName": "files/user-id/timestamp-random.mp4",
    "chunkSize": 5242880
  }
}
```

### 2. Upload Chunk

**POST** `{API}/files/chunk/upload`

Upload a single chunk of the file.

**Request (multipart/form-data):**

- `uploadId` (string): Upload session ID from initiate
- `partNumber` (integer): Chunk number (1-based, e.g., 1, 2, 3...)
- `chunk` (binary): Chunk data (5MB for most chunks, last chunk can be smaller)

**Response:**

```json
{
  "success": true,
  "message": "Chunk uploaded successfully",
  "data": {
    "partNumber": 1,
    "eTag": "etag-from-s3",
    "uploadedChunks": 1,
    "totalChunks": 100
  }
}
```

### 3. Complete Upload

**POST** `{API}/files/chunk/complete`

Finalize the upload after all chunks are uploaded.

**Request Body:**

```json
{
  "uploadId": "unique-upload-id"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Upload completed successfully",
  "data": {
    "id": "file-id-in-database",
    "fileName": "files/user-id/timestamp-random.mp4",
    "originalName": "my-video.mp4",
    "fileType": "video",
    "fileSize": 524288000,
    "fileUrl": "https://bucket.backblazeb2.com/...",
    "uploadedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### 4. Get Upload Status

**GET** `{API}/files/chunk/status/:uploadId`

Check the status of an ongoing upload.

**Response:**

```json
{
  "success": true,
  "data": {
    "uploadId": "unique-upload-id",
    "fileName": "files/user-id/timestamp-random.mp4",
    "originalName": "my-video.mp4",
    "totalSize": 524288000,
    "totalChunks": 100,
    "uploadedChunks": 45,
    "status": "uploading",
    "parts": [
      { "partNumber": 1, "size": 5242880 },
      { "partNumber": 2, "size": 5242880 }
    ],
    "expiresAt": "2025-01-16T10:30:00.000Z"
  }
}
```

### 5. Abort Upload

**POST** `{API}/files/chunk/abort`

Cancel an ongoing upload and clean up partial data.

**Request Body:**

```json
{
  "uploadId": "unique-upload-id"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Upload aborted successfully"
}
```

## Client-Side Implementation Example

### JavaScript/TypeScript Example

```typescript
class ChunkedUploader {
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly API_URL = "http://localhost:4000{API}/files/chunk";
  private authToken: string;

  constructor(authToken: string) {
    this.authToken = authToken;
  }

  async uploadVideo(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    // Step 1: Calculate chunks
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    // Step 2: Initiate upload
    const initiateResponse = await fetch(`${this.API_URL}/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        originalName: file.name,
        mimeType: file.type,
        totalSize: file.size,
        totalChunks,
      }),
    });

    const {
      data: { uploadId },
    } = await initiateResponse.json();

    // Step 3: Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("partNumber", String(i + 1));
      formData.append("chunk", chunk);

      await fetch(`${this.API_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
        body: formData,
      });

      // Report progress
      if (onProgress) {
        const progress = ((i + 1) / totalChunks) * 100;
        onProgress(progress);
      }
    }

    // Step 4: Complete upload
    const completeResponse = await fetch(`${this.API_URL}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({ uploadId }),
    });

    return await completeResponse.json();
  }

  async abortUpload(uploadId: string): Promise<void> {
    await fetch(`${this.API_URL}/abort`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({ uploadId }),
    });
  }
}

// Usage
const uploader = new ChunkedUploader("your-auth-token");
const videoFile = document.querySelector('input[type="file"]').files[0];

uploader
  .uploadVideo(videoFile, (progress) => {
    console.log(`Upload progress: ${progress.toFixed(2)}%`);
  })
  .then((result) => {
    console.log("Upload complete:", result);
  })
  .catch((error) => {
    console.error("Upload failed:", error);
  });
```

### React Example with Progress

```tsx
import React, { useState } from "react";

const VideoUploader: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const API_URL = "http://localhost:4000{API}/files/chunk";

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Initiate
      const initiateRes = await fetch(`${API_URL}/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type,
          totalSize: file.size,
          totalChunks,
        }),
      });
      const {
        data: { uploadId },
      } = await initiateRes.json();
      setUploadId(uploadId);

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("uploadId", uploadId);
        formData.append("partNumber", String(i + 1));
        formData.append("chunk", chunk);

        await fetch(`${API_URL}/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        });

        setProgress(((i + 1) / totalChunks) * 100);
      }

      // Complete
      const completeRes = await fetch(`${API_URL}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ uploadId }),
      });

      const result = await completeRes.json();
      console.log("Upload complete:", result);
      alert("Video uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
      setUploadId(null);
    }
  };

  const handleAbort = async () => {
    if (uploadId) {
      await fetch(`${API_URL}/abort`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ uploadId }),
      });
      setUploading(false);
      setUploadId(null);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && (
        <div>
          <progress value={progress} max={100} />
          <span>{progress.toFixed(2)}%</span>
          <button onClick={handleAbort}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
```

## Technical Details

### Chunk Size

- **Standard chunk size**: 5MB (5,242,880 bytes)
- **Minimum chunk size**: 5MB (except for the last chunk)
- **Maximum chunk size**: 10MB

### File Size Limits

- **Regular upload**: Up to 100MB (use `{API}/files/upload`)
- **Chunked upload**: 100MB to 10GB (use `{API}/files/chunk/*`)

### Upload Session

- **Expiration**: 24 hours from initiation
- **Auto-cleanup**: Runs every 6 hours to remove expired sessions
- **Status tracking**: All chunks and their ETags are stored in MongoDB

### Supported Video Formats

- MP4 (video/mp4)
- WebM (video/webm)
- QuickTime (video/quicktime)
- AVI (video/x-msvideo)
- MPEG (video/mpeg)

## Error Handling

### Common Errors

**400 Bad Request**

- Missing required fields
- Invalid file type
- File size exceeds limit
- Not all chunks uploaded

**401 Unauthorized**

- Missing or invalid authentication token

**404 Not Found**

- Upload session not found (may have expired)

**500 Internal Server Error**

- S3/B2 upload failure
- Database error

### Best Practices

1. **Always check upload status** before completing to ensure all chunks are uploaded
2. **Implement retry logic** for failed chunk uploads
3. **Store uploadId** locally to resume interrupted uploads
4. **Abort uploads** when user cancels to free up resources
5. **Validate file size** on client-side before initiating upload

## Cleanup and Maintenance

The system automatically cleans up expired uploads every 6 hours. To manually trigger cleanup:

```typescript
import { cleanupExpiredUploads } from "./utils/chunk-upload.service";

const count = await cleanupExpiredUploads();
console.log(`Cleaned up ${count} expired uploads`);
```

## Database Schema

### ChunkUpload Model

```typescript
{
  userId: ObjectId,
  uploadId: string, // S3 multipart upload ID
  fileName: string,
  originalName: string,
  mimeType: string,
  fileType: "video",
  totalSize: number,
  totalChunks: number,
  uploadedChunks: number,
  parts: [{
    partNumber: number,
    eTag: string,
    size: number
  }],
  status: "initiated" | "uploading" | "completed" | "failed" | "aborted",
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Monitoring

Monitor chunked uploads via database queries:

```javascript
// Active uploads
db.chunkuploads.find({ status: { $in: ["initiated", "uploading"] } });

// Completed uploads in last 24h
db.chunkuploads.find({
  status: "completed",
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
});

// Failed/aborted uploads
db.chunkuploads.find({ status: { $in: ["failed", "aborted"] } });
```
