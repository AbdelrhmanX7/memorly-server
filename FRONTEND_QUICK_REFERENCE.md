# Frontend Quick Reference Card - Chunked Upload

## 📦 What You Need to Know

### File Size Routing Logic
```javascript
const MAX_REGULAR_UPLOAD = 100 * 1024 * 1024; // 100MB

if (file.size <= MAX_REGULAR_UPLOAD) {
  // Use regular upload: POST {API}files/upload
  uploadRegular(file);
} else {
  // Use chunked upload: POST {API}files/chunk/*
  uploadChunked(file);
}
```

---

## 🎯 Three-Step Process

### Step 1: INITIATE
```javascript
POST {API}files/chunk/initiate

// Send:
{
  "originalName": file.name,
  "mimeType": file.type,
  "totalSize": file.size,
  "totalChunks": Math.ceil(file.size / (5 * 1024 * 1024))
}

// Get:
{
  "uploadId": "xyz123",  // ← SAVE THIS!
  "fileName": "...",
  "chunkSize": 5242880
}
```

### Step 2: UPLOAD (Loop for each chunk)
```javascript
POST {API}files/chunk/upload

// Send FormData:
const formData = new FormData();
formData.append('uploadId', 'xyz123');
formData.append('partNumber', '1'); // 1, 2, 3...
formData.append('chunk', chunkBlob);

// Get:
{
  "partNumber": 1,
  "uploadedChunks": 1,  // ← Use for progress bar
  "totalChunks": 100
}
```

### Step 3: COMPLETE
```javascript
POST {API}files/chunk/complete

// Send:
{
  "uploadId": "xyz123"
}

// Get:
{
  "id": "file_id",
  "fileUrl": "https://...",  // ← Use to display video
  "fileSize": 524288000
}
```

---

## 📝 Copy-Paste Code

### TypeScript Function
```typescript
async function uploadLargeVideo(
  file: File,
  token: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const API = 'http://localhost:4000{API}files/chunk';

  // STEP 1: Initiate
  const initRes = await fetch(`${API}/initiate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      originalName: file.name,
      mimeType: file.type,
      totalSize: file.size,
      totalChunks,
    }),
  });
  const { data: { uploadId } } = await initRes.json();

  // STEP 2: Upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('partNumber', String(i + 1));
    formData.append('chunk', chunk);

    await fetch(`${API}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    onProgress?.(((i + 1) / totalChunks) * 100);
  }

  // STEP 3: Complete
  const completeRes = await fetch(`${API}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadId }),
  });
  const { data } = await completeRes.json();

  return data.fileUrl;
}

// USAGE:
const videoUrl = await uploadLargeVideo(
  file,
  authToken,
  (percent) => console.log(`${percent}% done`)
);
```

---

## 🎨 UI Components

### Progress Bar Component
```tsx
interface UploadProgressProps {
  uploadedChunks: number;
  totalChunks: number;
  onCancel: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  uploadedChunks,
  totalChunks,
  onCancel,
}) => {
  const percent = (uploadedChunks / totalChunks) * 100;

  return (
    <div className="upload-progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p>{uploadedChunks} / {totalChunks} chunks ({percent.toFixed(1)}%)</p>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
};
```

### File Size Display
```typescript
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(2) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(2) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(2) + ' GB';
}

// Usage: formatBytes(524288000) → "500.00 MB"
```

---

## 🔧 Helper Functions

### Calculate Chunks
```javascript
function calculateChunks(fileSize) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  return Math.ceil(fileSize / CHUNK_SIZE);
}
```

### Validate File
```javascript
function validateVideo(file) {
  // Check type
  if (!file.type.startsWith('video/')) {
    throw new Error('Please select a video file');
  }

  // Check size
  const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
  if (file.size > MAX_SIZE) {
    throw new Error('File size exceeds 10GB limit');
  }

  return true;
}
```

### Retry Failed Chunk
```javascript
async function uploadChunkWithRetry(
  chunk,
  uploadId,
  partNumber,
  token,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('partNumber', String(partNumber));
      formData.append('chunk', chunk);

      const res = await fetch('{API}files/chunk/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
```

---

## ⚠️ Error Handling

### Error Messages
```javascript
const ERROR_MESSAGES = {
  401: 'Session expired. Please log in again.',
  400: 'Invalid file. Check file type and size.',
  404: 'Upload session expired. Please restart upload.',
  500: 'Upload failed. Please try again.',
};

function handleUploadError(error) {
  const statusCode = error.response?.status;
  const message = ERROR_MESSAGES[statusCode] || 'Upload failed';
  alert(message);
}
```

### Try-Catch Pattern
```javascript
try {
  const url = await uploadLargeVideo(file, token, onProgress);
  console.log('Success:', url);
} catch (error) {
  if (error.message.includes('401')) {
    // Redirect to login
    window.location.href = '/login';
  } else {
    alert('Upload failed: ' + error.message);
  }
}
```

---

## 🎯 Optional Features

### Cancel Upload
```javascript
POST {API}files/chunk/abort
Body: { "uploadId": "xyz123" }
```

### Check Status
```javascript
GET {API}files/chunk/status/:uploadId
Response: {
  "uploadedChunks": 45,
  "totalChunks": 100,
  "status": "uploading"
}
```

### Resume Upload
```javascript
// 1. Check which chunks uploaded
const status = await fetch(`{API}files/chunk/status/${uploadId}`);
const { uploadedChunks, totalChunks } = await status.json();

// 2. Resume from next chunk
for (let i = uploadedChunks; i < totalChunks; i++) {
  // Upload chunk i+1
}
```

---

## 📊 State Management (Redux Example)

```typescript
// uploadSlice.ts
interface UploadState {
  uploading: boolean;
  uploadId: string | null;
  progress: number;
  error: string | null;
}

const uploadSlice = createSlice({
  name: 'upload',
  initialState: {
    uploading: false,
    uploadId: null,
    progress: 0,
    error: null,
  } as UploadState,
  reducers: {
    uploadStarted: (state, action) => {
      state.uploading = true;
      state.uploadId = action.payload;
      state.progress = 0;
      state.error = null;
    },
    uploadProgress: (state, action) => {
      state.progress = action.payload;
    },
    uploadCompleted: (state) => {
      state.uploading = false;
      state.progress = 100;
      state.uploadId = null;
    },
    uploadFailed: (state, action) => {
      state.uploading = false;
      state.error = action.payload;
      state.uploadId = null;
    },
  },
});
```

---

## 🎬 Complete React Example

```tsx
import React, { useState } from 'react';

const VideoUploadForm: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const CHUNK_SIZE = 5 * 1024 * 1024;
  const API = 'http://localhost:4000{API}files/chunk';
  const token = localStorage.getItem('authToken') || '';

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Initiate
      const initRes = await fetch(`${API}/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type,
          totalSize: file.size,
          totalChunks,
        }),
      });
      const { data: { uploadId } } = await initRes.json();

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('partNumber', String(i + 1));
        formData.append('chunk', chunk);

        await fetch(`${API}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        setProgress(((i + 1) / totalChunks) * 100);
      }

      // Complete
      const completeRes = await fetch(`${API}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uploadId }),
      });
      const { data } = await completeRes.json();

      setVideoUrl(data.fileUrl);
      alert('Upload complete!');
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        disabled={uploading}
      />

      <button onClick={handleUpload} disabled={!file || uploading}>
        Upload
      </button>

      {uploading && (
        <div>
          <progress value={progress} max={100} />
          <span>{progress.toFixed(1)}%</span>
        </div>
      )}

      {videoUrl && (
        <video src={videoUrl} controls style={{ maxWidth: '100%' }} />
      )}
    </div>
  );
};

export default VideoUploadForm;
```

---

## 🔗 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `{API}files/upload` | POST | Regular upload (<100MB) |
| `{API}files/chunk/initiate` | POST | Start chunked upload |
| `{API}files/chunk/upload` | POST | Upload one chunk |
| `{API}files/chunk/complete` | POST | Finish upload |
| `{API}files/chunk/status/:id` | GET | Check progress |
| `{API}files/chunk/abort` | POST | Cancel upload |

---

## 📋 Checklist

- [ ] Validate file type (video only)
- [ ] Validate file size (<10GB)
- [ ] Calculate totalChunks correctly
- [ ] Store uploadId for later use
- [ ] Show progress to user
- [ ] Handle errors gracefully
- [ ] Implement cancel button
- [ ] Test with large files (>2GB)
- [ ] Test network interruption
- [ ] Add retry logic for failed chunks

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token is valid and not expired |
| Upload fails at chunk 1 | Verify uploadId from initiate step |
| Progress stuck at 99% | Check if last chunk uploaded successfully |
| "Session not found" | Upload expired (24h limit) - restart |
| Out of memory | Using wrong chunk size - use 5MB |

---

## 📞 Need Help?

1. Check full docs: `FRONTEND_INTEGRATION_GUIDE.md`
2. See flow diagrams: `UPLOAD_FLOW_DIAGRAM.md`
3. Review API docs: `CHUNKED_UPLOAD.md`
4. Contact backend team with uploadId and error message

---

**Quick reminder**:
- Chunk size = **5MB** (5,242,880 bytes)
- Max file size = **10GB**
- Session timeout = **24 hours**
- Progress = uploadedChunks / totalChunks × 100
