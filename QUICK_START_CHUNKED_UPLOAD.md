# Quick Start: Chunked Video Upload

## 🎯 TL;DR

Upload videos up to **10GB** by splitting them into **5MB chunks**.

## 📋 When to Use

- ✅ Video files **larger than 100MB**
- ✅ Files up to **10GB**
- ❌ Images (use regular upload)
- ❌ Videos under 100MB (use regular upload)

## 🔑 API Endpoints

| Endpoint                       | Method | Purpose         |
| ------------------------------ | ------ | --------------- |
| `{API}/files/chunk/initiate`   | POST   | Start upload    |
| `{API}/files/chunk/upload`     | POST   | Upload chunk    |
| `{API}/files/chunk/complete`   | POST   | Finalize upload |
| `{API}/files/chunk/abort`      | POST   | Cancel upload   |
| `{API}/files/chunk/status/:id` | GET    | Check progress  |

## 🚀 3-Step Upload Process

### Step 1: Initiate

```bash
curl -X POST http://localhost:4000{API}/files/chunk/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalName": "video.mp4",
    "mimeType": "video/mp4",
    "totalSize": 524288000,
    "totalChunks": 100
  }'

# Response: { "uploadId": "xyz123", "chunkSize": 5242880 }
```

### Step 2: Upload Chunks (Repeat for each chunk)

```bash
curl -X POST http://localhost:4000{API}/files/chunk/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "uploadId=xyz123" \
  -F "partNumber=1" \
  -F "chunk=@chunk1.bin"

# Response: { "partNumber": 1, "uploadedChunks": 1, "totalChunks": 100 }
```

### Step 3: Complete

```bash
curl -X POST http://localhost:4000{API}/files/chunk/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "uploadId": "xyz123" }'

# Response: { "fileUrl": "https://...", "fileSize": 524288000 }
```

## 💻 JavaScript Example (Browser)

```javascript
async function uploadLargeVideo(file) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Step 1: Initiate
  const { uploadId } = await fetch("{API}/files/chunk/initiate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      originalName: file.name,
      mimeType: file.type,
      totalSize: file.size,
      totalChunks,
    }),
  })
    .then((r) => r.json())
    .then((d) => d.data);

  // Step 2: Upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("partNumber", i + 1);
    formData.append("chunk", chunk);

    await fetch("{API}/files/chunk/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    console.log(`Progress: ${(((i + 1) / totalChunks) * 100).toFixed(1)}%`);
  }

  // Step 3: Complete
  const result = await fetch("{API}/files/chunk/complete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uploadId }),
  }).then((r) => r.json());

  return result.data;
}
```

## ⚙️ Configuration

### Server-Side

No configuration needed! The server automatically:

- Cleans up expired uploads every 6 hours
- Expires uploads after 24 hours
- Uses 5MB chunk size

### Client-Side

```javascript
const CONFIG = {
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VIDEO_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
  API_URL: "http://localhost:4000{API}/files/chunk",
};
```

## 📊 Progress Tracking

```javascript
// Get upload status
const status = await fetch(`{API}/files/chunk/status/${uploadId}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log(`${status.uploadedChunks}/${status.totalChunks} chunks uploaded`);
console.log(`Status: ${status.status}`); // initiated, uploading, completed, failed, aborted
```

## ❌ Cancel Upload

```javascript
await fetch("{API}/files/chunk/abort", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ uploadId }),
});
```

## 🔍 Troubleshooting

### Upload fails at initiation

- ✅ Check video MIME type is valid (video/mp4, video/webm, etc.)
- ✅ Verify file size is under 10GB
- ✅ Ensure totalChunks matches file size / chunk size

### Chunk upload fails

- ✅ Verify partNumber starts at 1 (not 0)
- ✅ Check chunk is not larger than 10MB
- ✅ Ensure uploadId is correct

### Complete fails

- ✅ Verify all chunks uploaded (check status endpoint)
- ✅ Check upload hasn't expired (24 hour limit)
- ✅ Ensure uploadId is valid

### Upload expires

- ⏰ Complete upload within 24 hours
- 🔄 Restart upload if expired

## 📝 Response Formats

### Success Response

```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

## 🎬 Supported Formats

- ✅ MP4 (video/mp4)
- ✅ WebM (video/webm)
- ✅ QuickTime (video/quicktime)
- ✅ AVI (video/x-msvideo)
- ✅ MPEG (video/mpeg)

## 📈 Limits

| Item             | Limit             |
| ---------------- | ----------------- |
| Max file size    | 10GB              |
| Chunk size       | 5MB (recommended) |
| Max chunk size   | 10MB              |
| Session expiry   | 24 hours          |
| Cleanup interval | Every 6 hours     |

## 🔐 Authentication

All endpoints require Bearer token:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📚 More Information

- Full documentation: `CHUNKED_UPLOAD.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- API docs: http://localhost:4000/api-docs
