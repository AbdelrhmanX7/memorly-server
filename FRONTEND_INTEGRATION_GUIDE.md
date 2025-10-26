# Frontend Integration Guide - Chunked Video Upload

## 📋 Overview

This guide provides everything your frontend team needs to implement large video uploads (up to 10GB) using the chunked upload API.

---

## 🎯 When to Use Which Upload Method

### Regular Upload (`{API}files/upload`)

- ✅ **Images**: All sizes (max 10MB)
- ✅ **Small videos**: Under 100MB
- ⚡ **Advantage**: Single request, faster for small files

### Chunked Upload (`{API}files/chunk/*`)

- ✅ **Large videos**: 100MB to 10GB
- ⚡ **Advantages**: Progress tracking, resumable, handles network interruptions

---

## 🔄 How Chunked Upload Works

### High-Level Flow

```
1. User selects video file
   ↓
2. Frontend splits file into 5MB chunks
   ↓
3. Call INITIATE endpoint → Get uploadId
   ↓
4. Loop: Upload each chunk (1, 2, 3...)
   ↓
5. Call COMPLETE endpoint → Get final file URL
```

### Technical Details

- **Chunk Size**: 5MB (5,242,880 bytes)
- **Last Chunk**: Can be smaller than 5MB
- **Upload Order**: Chunks must be numbered sequentially (1, 2, 3...)
- **Session Timeout**: 24 hours from initiation
- **Storage**: Backblaze B2 (S3-compatible)

---

## 🔌 API Endpoints

### Base URL

```
Production: https://your-domain.com{API}files/chunk
Development: http://localhost:4000{API}files/chunk
```

### Authentication

All endpoints require JWT Bearer token:

```
Authorization: Bearer <user_token>
```

---

## 📡 API Reference

### 1️⃣ Initiate Upload

**Endpoint**: `POST {API}files/chunk/initiate`

**When to call**: Before uploading any chunks

**Request Headers**:

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**:

```json
{
  "originalName": "vacation-video.mp4",
  "mimeType": "video/mp4",
  "totalSize": 524288000,
  "totalChunks": 100
}
```

**Field Descriptions**:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `originalName` | string | Original filename with extension | `"my-video.mp4"` |
| `mimeType` | string | Video MIME type | `"video/mp4"` |
| `totalSize` | number | File size in bytes | `524288000` |
| `totalChunks` | number | Number of chunks (file size / 5MB, rounded up) | `100` |

**Response** (Success - 201):

```json
{
  "success": true,
  "message": "Chunked upload initiated successfully",
  "data": {
    "uploadId": "wJalrXUtnFEMI.K7MDENG",
    "fileName": "files/user123/1705939200000-a3f5b8c2.mp4",
    "chunkSize": 5242880
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `uploadId` | string | **IMPORTANT**: Store this! You'll need it for all subsequent requests |
| `fileName` | string | Generated filename in storage (for reference) |
| `chunkSize` | number | Recommended chunk size (5MB) |

**Error Response** (400):

```json
{
  "success": false,
  "error": "Invalid file type. Only video files are supported for chunked upload.",
  "statusCode": 400
}
```

---

### 2️⃣ Upload Chunk

**Endpoint**: `POST {API}files/chunk/upload`

**When to call**: For each chunk of the file (1, 2, 3... up to totalChunks)

**Request Headers**:

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body** (FormData):

```javascript
const formData = new FormData();
formData.append('uploadId', 'wJalrXUtnFEMI.K7MDENG');
formData.append('partNumber', '1'); // String, not number
formData.append('chunk', <Blob/File>); // Binary chunk data
```

**Field Descriptions**:
| Field | Type | Description |
|-------|------|-------------|
| `uploadId` | string | Upload ID from initiate response |
| `partNumber` | string | Chunk number (1-based: "1", "2", "3"...) |
| `chunk` | Blob/File | Binary chunk data (5MB max, except last chunk) |

**Response** (Success - 200):

```json
{
  "success": true,
  "message": "Chunk uploaded successfully",
  "data": {
    "partNumber": 1,
    "eTag": "d41d8cd98f00b204e9800998ecf8427e",
    "uploadedChunks": 1,
    "totalChunks": 100
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `partNumber` | number | Chunk number that was uploaded |
| `eTag` | string | S3 entity tag (for verification) |
| `uploadedChunks` | number | How many chunks uploaded so far |
| `totalChunks` | number | Total chunks needed |

**Progress Calculation**:

```javascript
const progress = (uploadedChunks / totalChunks) * 100; // Percentage
```

---

### 3️⃣ Complete Upload

**Endpoint**: `POST {API}files/chunk/complete`

**When to call**: After ALL chunks are uploaded

**Request Headers**:

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**:

```json
{
  "uploadId": "wJalrXUtnFEMI.K7MDENG"
}
```

**Response** (Success - 200):

```json
{
  "success": true,
  "message": "Upload completed successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "fileName": "files/user123/1705939200000-a3f5b8c2.mp4",
    "originalName": "vacation-video.mp4",
    "fileType": "video",
    "fileSize": 524288000,
    "fileUrl": "https://s3.us-west-002.backblazeb2.com/bucket/files/user123/1705939200000-a3f5b8c2.mp4",
    "uploadedAt": "2025-01-22T15:30:00.000Z"
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Database ID (use for delete/get operations) |
| `fileUrl` | string | **Public URL** to access the video |
| `fileSize` | number | Total file size in bytes |
| `uploadedAt` | string | ISO timestamp |

---

### 4️⃣ Get Upload Status (Optional)

**Endpoint**: `GET {API}files/chunk/status/:uploadId`

**When to call**: To check progress or resume interrupted upload

**Request Headers**:

```
Authorization: Bearer <token>
```

**Response** (Success - 200):

```json
{
  "success": true,
  "data": {
    "uploadId": "wJalrXUtnFEMI.K7MDENG",
    "fileName": "files/user123/1705939200000-a3f5b8c2.mp4",
    "originalName": "vacation-video.mp4",
    "totalSize": 524288000,
    "totalChunks": 100,
    "uploadedChunks": 45,
    "status": "uploading",
    "parts": [
      { "partNumber": 1, "size": 5242880 },
      { "partNumber": 2, "size": 5242880 }
      // ... more parts
    ],
    "expiresAt": "2025-01-23T15:30:00.000Z"
  }
}
```

**Status Values**:
| Status | Meaning |
|--------|---------|
| `initiated` | Upload session created, no chunks uploaded yet |
| `uploading` | At least one chunk uploaded |
| `completed` | All chunks uploaded and merged |
| `failed` | Upload failed (error occurred) |
| `aborted` | User cancelled the upload |

---

### 5️⃣ Abort Upload (Optional)

**Endpoint**: `POST {API}files/chunk/abort`

**When to call**: When user cancels upload

**Request Headers**:

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**:

```json
{
  "uploadId": "wJalrXUtnFEMI.K7MDENG"
}
```

**Response** (Success - 200):

```json
{
  "success": true,
  "message": "Upload aborted successfully"
}
```

---

## 💻 Implementation Examples

### React Hook (TypeScript)

```typescript
import { useState, useCallback } from "react";

interface UploadProgress {
  uploadedChunks: number;
  totalChunks: number;
  percentage: number;
}

interface UploadResult {
  id: string;
  fileUrl: string;
  fileName: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const API_BASE = "http://localhost:4000{API}files/chunk";

export const useChunkedUpload = (token: string) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const uploadVideo = useCallback(
    async (file: File): Promise<UploadResult> => {
      setUploading(true);

      try {
        // Calculate chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Step 1: Initiate
        const initiateRes = await fetch(`${API_BASE}/initiate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            originalName: file.name,
            mimeType: file.type,
            totalSize: file.size,
            totalChunks,
          }),
        });

        if (!initiateRes.ok) {
          const error = await initiateRes.json();
          throw new Error(error.error || "Failed to initiate upload");
        }

        const {
          data: { uploadId },
        } = await initiateRes.json();
        setUploadId(uploadId);

        // Step 2: Upload chunks
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append("uploadId", uploadId);
          formData.append("partNumber", String(i + 1));
          formData.append("chunk", chunk);

          const uploadRes = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!uploadRes.ok) {
            const error = await uploadRes.json();
            throw new Error(error.error || `Failed to upload chunk ${i + 1}`);
          }

          const { data } = await uploadRes.json();

          // Update progress
          setProgress({
            uploadedChunks: data.uploadedChunks,
            totalChunks: data.totalChunks,
            percentage: (data.uploadedChunks / data.totalChunks) * 100,
          });
        }

        // Step 3: Complete
        const completeRes = await fetch(`${API_BASE}/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uploadId }),
        });

        if (!completeRes.ok) {
          const error = await completeRes.json();
          throw new Error(error.error || "Failed to complete upload");
        }

        const { data } = await completeRes.json();

        return {
          id: data.id,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
        };
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      } finally {
        setUploading(false);
        setUploadId(null);
        setProgress(null);
      }
    },
    [token]
  );

  const abortUpload = useCallback(async () => {
    if (!uploadId) return;

    try {
      await fetch(`${API_BASE}/abort`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uploadId }),
      });
    } catch (error) {
      console.error("Abort error:", error);
    } finally {
      setUploading(false);
      setUploadId(null);
      setProgress(null);
    }
  }, [uploadId, token]);

  return {
    uploadVideo,
    abortUpload,
    uploading,
    progress,
  };
};
```

### Usage in Component

```tsx
import React, { useState } from "react";
import { useChunkedUpload } from "./useChunkedUpload";

const VideoUploader: React.FC = () => {
  const token = localStorage.getItem("authToken") || "";
  const { uploadVideo, abortUpload, uploading, progress } =
    useChunkedUpload(token);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file");
      return;
    }

    // Validate file size (10GB max)
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    if (file.size > maxSize) {
      alert("File size exceeds 10GB limit");
      return;
    }

    try {
      const result = await uploadVideo(file);
      setVideoUrl(result.fileUrl);
      alert("Upload complete!");
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Upload Video</h2>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {uploading && progress && (
        <div style={{ marginTop: "20px" }}>
          <div>
            Uploading: {progress.uploadedChunks} / {progress.totalChunks} chunks
          </div>
          <progress value={progress.percentage} max={100} />
          <div>{progress.percentage.toFixed(1)}%</div>
          <button onClick={abortUpload}>Cancel</button>
        </div>
      )}

      {videoUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Upload Complete!</h3>
          <video src={videoUrl} controls style={{ maxWidth: "100%" }} />
          <div>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              Open video
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
```

---

## 🌐 Vanilla JavaScript Example

```javascript
class ChunkedUploader {
  constructor(apiBaseUrl, authToken) {
    this.API_BASE = apiBaseUrl;
    this.token = authToken;
    this.CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  }

  async uploadFile(file, onProgress) {
    // Calculate chunks
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    // Step 1: Initiate
    const initiateResponse = await fetch(`${this.API_BASE}/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
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

    // Step 2: Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("partNumber", String(i + 1));
      formData.append("chunk", chunk);

      const uploadResponse = await fetch(`${this.API_BASE}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      });

      const { data } = await uploadResponse.json();

      // Report progress
      if (onProgress) {
        onProgress({
          uploadedChunks: data.uploadedChunks,
          totalChunks: data.totalChunks,
          percentage: (data.uploadedChunks / data.totalChunks) * 100,
        });
      }
    }

    // Step 3: Complete
    const completeResponse = await fetch(`${this.API_BASE}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ uploadId }),
    });

    const { data } = await completeResponse.json();
    return data;
  }
}

// Usage
const uploader = new ChunkedUploader(
  "http://localhost:4000{API}files/chunk",
  "your-auth-token"
);

const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];

  const result = await uploader.uploadFile(file, (progress) => {
    console.log(`${progress.percentage.toFixed(1)}% complete`);
  });

  console.log("Upload complete!", result.fileUrl);
});
```

---

## 🎨 UI/UX Recommendations

### Progress Display

```jsx
<div className="upload-progress">
  <div className="progress-bar">
    <div
      className="progress-fill"
      style={{ width: `${progress.percentage}%` }}
    />
  </div>
  <div className="progress-text">
    {progress.uploadedChunks} / {progress.totalChunks} chunks (
    {progress.percentage.toFixed(1)}%)
  </div>
  <div className="upload-speed">
    {/* Calculate and show upload speed */}
    Uploading at 5.2 MB/s
  </div>
</div>
```

### File Size Display

```javascript
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}
```

### Upload Time Estimation

```javascript
function estimateTimeRemaining(uploadedChunks, totalChunks, startTime) {
  const elapsed = Date.now() - startTime;
  const avgTimePerChunk = elapsed / uploadedChunks;
  const remainingChunks = totalChunks - uploadedChunks;
  const estimatedMs = remainingChunks * avgTimePerChunk;

  const minutes = Math.floor(estimatedMs / 60000);
  const seconds = Math.floor((estimatedMs % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
}
```

---

## 🛡️ Error Handling

### Common Errors

| Error                        | Cause                             | Solution                 |
| ---------------------------- | --------------------------------- | ------------------------ |
| 401 Unauthorized             | Invalid/expired token             | Refresh authentication   |
| 400 Invalid file type        | Wrong MIME type                   | Only allow video files   |
| 400 File too large           | Size > 10GB                       | Show file size limit     |
| 400 Not all chunks uploaded  | Missing chunks before complete    | Track uploaded chunks    |
| 404 Upload session not found | Expired (24h) or invalid uploadId | Restart upload           |
| 500 Server error             | S3/Database issue                 | Retry or contact support |

### Error Handling Pattern

```typescript
try {
  const result = await uploadVideo(file);
  // Success
} catch (error) {
  if (error.message.includes("401")) {
    // Token expired - redirect to login
    window.location.href = "/login";
  } else if (error.message.includes("400")) {
    // Validation error - show to user
    showError("Invalid file. Please check file type and size.");
  } else if (error.message.includes("404")) {
    // Session expired - restart upload
    showError("Upload session expired. Please try again.");
  } else {
    // Generic error
    showError("Upload failed. Please try again.");
  }
}
```

### Retry Logic

```typescript
async function uploadChunkWithRetry(
  chunk: Blob,
  uploadId: string,
  partNumber: number,
  maxRetries = 3
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("partNumber", String(partNumber));
      formData.append("chunk", chunk);

      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
}
```

---

## 📱 Mobile Considerations

### React Native Example

```typescript
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

const uploadVideoMobile = async () => {
  // Pick video
  const result = await DocumentPicker.getDocumentAsync({
    type: "video/*",
  });

  if (result.type !== "success") return;

  const { uri, name, mimeType, size } = result;

  // Read file in chunks
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(size / CHUNK_SIZE);

  // Initiate upload
  const initiateRes = await fetch(`${API_BASE}/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      originalName: name,
      mimeType,
      totalSize: size,
      totalChunks,
    }),
  });

  const {
    data: { uploadId },
  } = await initiateRes.json();

  // Upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const length = Math.min(CHUNK_SIZE, size - start);

    // Read chunk from file
    const chunkBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: start,
      length,
    });

    // Convert base64 to blob (React Native specific)
    const chunkBlob = await fetch(
      `data:${mimeType};base64,${chunkBase64}`
    ).then((res) => res.blob());

    // Upload chunk
    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("partNumber", String(i + 1));
    formData.append("chunk", chunkBlob);

    await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  }

  // Complete upload
  await fetch(`${API_BASE}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uploadId }),
  });
};
```

---

## 🧪 Testing Checklist

### Functional Tests

- [ ] Upload small video (< 100MB) using regular upload
- [ ] Upload large video (> 100MB) using chunked upload
- [ ] Upload very large video (> 2GB)
- [ ] Cancel upload mid-progress
- [ ] Check upload status during upload
- [ ] Complete upload and verify video URL works
- [ ] Try to complete upload with missing chunks (should fail)
- [ ] Try to upload with expired token (should fail)

### Edge Cases

- [ ] Upload exactly 5MB file (single chunk)
- [ ] Upload 5MB + 1 byte file (two chunks)
- [ ] Upload with very slow network
- [ ] Upload with network interruption (pause/resume)
- [ ] Upload multiple files simultaneously
- [ ] Leave upload incomplete for 24+ hours (should expire)

### Performance Tests

- [ ] Upload 1GB video - measure time
- [ ] Upload 5GB video - measure time
- [ ] Upload 10GB video - measure time
- [ ] Monitor memory usage during upload
- [ ] Test on slow 3G network
- [ ] Test on mobile device

---

## 📊 Analytics & Monitoring

### Events to Track

```typescript
// Track upload start
analytics.track("video_upload_started", {
  fileSize: file.size,
  fileType: file.type,
  totalChunks,
});

// Track upload progress
analytics.track("video_upload_progress", {
  uploadId,
  progress: progress.percentage,
  uploadedChunks: progress.uploadedChunks,
});

// Track upload complete
analytics.track("video_upload_completed", {
  uploadId,
  fileSize: result.fileSize,
  duration: uploadDuration,
  averageSpeed: fileSize / uploadDuration,
});

// Track upload error
analytics.track("video_upload_failed", {
  uploadId,
  error: error.message,
  failedAtChunk: progress?.uploadedChunks,
});

// Track upload cancelled
analytics.track("video_upload_cancelled", {
  uploadId,
  cancelledAtChunk: progress?.uploadedChunks,
});
```

---

## 🔒 Security Notes

1. **Token Storage**: Store JWT securely (httpOnly cookies or secure storage)
2. **File Validation**: Always validate file type and size on frontend
3. **HTTPS Only**: Never upload over HTTP in production
4. **Sensitive Data**: Don't log uploadId or token to analytics
5. **Rate Limiting**: Be aware of potential API rate limits

---

## 📞 Support & Troubleshooting

### Debug Mode

```typescript
const DEBUG = process.env.NODE_ENV === "development";

if (DEBUG) {
  console.log("Upload initiated:", { uploadId, totalChunks });
  console.log("Chunk uploaded:", { partNumber, uploadedChunks, totalChunks });
  console.log("Upload completed:", result);
}
```

### Logging Upload Sessions

```typescript
// Save to localStorage for debugging
localStorage.setItem(
  "lastUploadSession",
  JSON.stringify({
    uploadId,
    fileName: file.name,
    startTime: Date.now(),
    totalChunks,
    uploadedChunks: progress.uploadedChunks,
  })
);
```

### Common Questions

**Q: What if the user closes the browser during upload?**
A: Upload will be aborted. Upload session expires after 24 hours. Consider implementing browser beforeunload warning.

**Q: Can we upload multiple videos at once?**
A: Yes, but recommended to limit to 2-3 simultaneous uploads to avoid overwhelming the browser/network.

**Q: How do we resume a failed upload?**
A: Call the status endpoint to check which chunks are uploaded, then continue from the next chunk.

**Q: Can we compress videos before upload?**
A: Yes! Consider using libraries like `browser-image-compression` for client-side compression to reduce upload time.

---

## 📝 Summary

1. **Use chunked upload for videos > 100MB**
2. **Chunk size is always 5MB** (except last chunk)
3. **Three main steps**: Initiate → Upload Chunks → Complete
4. **Track progress** using uploadedChunks/totalChunks
5. **Handle errors** and implement retry logic
6. **Show progress** to users for better UX
7. **Store uploadId** to resume interrupted uploads

---

**Questions?** Contact the backend team or check the full documentation in `CHUNKED_UPLOAD.md`
