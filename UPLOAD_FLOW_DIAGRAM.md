# Upload Flow Diagrams

## 🎬 Regular Upload (< 100MB)

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ POST {API}/files/upload
       │ (FormData with file)
       ▼
┌─────────────┐
│   Backend   │
└──────┬──────┘
       │
       │ Validate file
       │ Upload to B2
       │ Save to DB
       ▼
┌─────────────┐
│  Response   │
│  file URL   │
└─────────────┘
```

---

## 🎥 Chunked Upload (> 100MB, up to 10GB)

### Full Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ 1. User selects video file
                            ▼
                   ┌────────────────┐
                   │ Calculate      │
                   │ - totalChunks  │ totalChunks = Math.ceil(fileSize / 5MB)
                   │ - totalSize    │
                   └────────┬───────┘
                            │
                            │ 2. POST {API}/files/chunk/initiate
                            │    { originalName, mimeType, totalSize, totalChunks }
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Validate video type & size                          │  │
│  │ 2. Generate unique filename                            │  │
│  │ 3. Create S3 multipart upload → Get uploadId          │  │
│  │ 4. Save session to MongoDB (ChunkUpload model)        │  │
│  │ 5. Set expiration: now + 24 hours                      │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ Response: { uploadId, fileName, chunkSize }
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ FOR LOOP: i = 0 to totalChunks - 1                    │  │
│  │                                                         │  │
│  │   3. Slice chunk from file (5MB)                      │  │
│  │      chunk = file.slice(i * 5MB, (i+1) * 5MB)        │  │
│  │                                                         │  │
│  │   4. POST {API}/files/chunk/upload                     │  │
│  │      FormData: { uploadId, partNumber: i+1, chunk }   │  │
│  │        │                                               │  │
│  │        ▼                                               │  │
│  │   ┌──────────────────────────────────────────┐        │  │
│  │   │ BACKEND                                  │        │  │
│  │   │ - Find upload session                    │        │  │
│  │   │ - Upload chunk to S3 → Get ETag         │        │  │
│  │   │ - Save part info to MongoDB              │        │  │
│  │   │ - Update uploadedChunks counter          │        │  │
│  │   └────────────┬─────────────────────────────┘        │  │
│  │                │                                       │  │
│  │                │ Response: { partNumber, eTag,        │  │
│  │                │            uploadedChunks,           │  │
│  │                │            totalChunks }             │  │
│  │                ▼                                       │  │
│  │   5. Update progress UI                               │  │
│  │      progress = uploadedChunks / totalChunks * 100   │  │
│  │                                                         │  │
│  └─────────────────┬──────────────────────────────────────┘  │
│                    │ (Loop continues until all chunks done) │
└────────────────────┼──────────────────────────────────────────┘
                     │
                     │ All chunks uploaded!
                     │
                     │ 6. POST {API}/files/chunk/complete
                     │    { uploadId }
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Verify all chunks uploaded                          │  │
│  │ 2. Call S3 CompleteMultipartUpload                     │  │
│  │    - S3 merges all chunks into single file             │  │
│  │ 3. Save file metadata to File collection               │  │
│  │ 4. Mark upload session as "completed"                  │  │
│  │ 5. Return file URL                                     │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ Response: { id, fileUrl, fileSize, ... }
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 7. Show success message                                │  │
│  │ 8. Display video player with fileUrl                   │  │
│  │ 9. Save file metadata for later use                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Detailed Chunk Upload Sequence

```
Frontend                    Backend                      Backblaze B2
   │                           │                              │
   │──1. INITIATE──────────────▶│                              │
   │                           │──Create Multipart Upload────▶│
   │                           │◀─────uploadId─────────────────│
   │◀──uploadId────────────────│                              │
   │                           │                              │
   │──2. UPLOAD CHUNK 1────────▶│                              │
   │   (5MB, part 1)           │──Upload Part 1──────────────▶│
   │                           │◀─────ETag 1───────────────────│
   │◀──Progress: 1/100─────────│                              │
   │                           │                              │
   │──3. UPLOAD CHUNK 2────────▶│                              │
   │   (5MB, part 2)           │──Upload Part 2──────────────▶│
   │                           │◀─────ETag 2───────────────────│
   │◀──Progress: 2/100─────────│                              │
   │                           │                              │
   │         ...               │         ...                  │
   │                           │                              │
   │──N. UPLOAD CHUNK 100──────▶│                              │
   │   (last chunk)            │──Upload Part 100────────────▶│
   │                           │◀─────ETag 100─────────────────│
   │◀──Progress: 100/100───────│                              │
   │                           │                              │
   │──N+1. COMPLETE────────────▶│                              │
   │                           │──Complete Multipart Upload──▶│
   │                           │  (merge all 100 parts)       │
   │                           │◀─────File URL─────────────────│
   │◀──File URL & metadata────│                              │
   │                           │                              │
```

---

## 🔄 State Transitions

```
Upload Session States:

┌────────────┐
│  initiated │  ← Upload session created, no chunks yet
└──────┬─────┘
       │
       │ First chunk uploaded
       ▼
┌────────────┐
│ uploading  │  ← At least 1 chunk uploaded
└──────┬─────┘
       │
       ├──────── All chunks uploaded + Complete called ──────▶ ┌───────────┐
       │                                                        │ completed │
       │                                                        └───────────┘
       │
       ├──────── User cancels ───────────────────────────────▶ ┌───────────┐
       │                                                        │  aborted  │
       │                                                        └───────────┘
       │
       └──────── Error occurs ───────────────────────────────▶ ┌───────────┐
                                                                │  failed   │
                                                                └───────────┘
```

---

## 💾 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│                                                              │
│  ┌──────────────┐                                           │
│  │ Video File   │  10GB file                                │
│  │ "movie.mp4"  │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ Split into 2000 chunks                            │
│         ▼                                                    │
│  ┌─────────────────────────────────────┐                    │
│  │ Chunk 1 │ Chunk 2 │ ... │ Chunk 2000│  (5MB each)       │
│  └─────────────────────────────────────┘                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Upload one at a time
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Express)                         │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │ ChunkUpload Collection (MongoDB)         │               │
│  │                                           │               │
│  │ {                                         │               │
│  │   uploadId: "xyz123",                    │               │
│  │   userId: "user_id",                     │               │
│  │   fileName: "files/user/movie.mp4",      │               │
│  │   totalChunks: 2000,                     │               │
│  │   uploadedChunks: 1500,  ← Updates      │               │
│  │   parts: [                               │               │
│  │     { partNumber: 1, eTag: "...", ... }, │               │
│  │     { partNumber: 2, eTag: "...", ... }, │               │
│  │     ...                                  │               │
│  │   ],                                     │               │
│  │   status: "uploading"                    │               │
│  │ }                                        │               │
│  └──────────────────────────────────────────┘               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Forward to S3 API
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKBLAZE B2 (Storage)                      │
│                                                              │
│  Multipart Upload Session                                   │
│  ┌────────────────────────────────────────┐                 │
│  │ Part 1: 5MB  ✅ Uploaded               │                 │
│  │ Part 2: 5MB  ✅ Uploaded               │                 │
│  │ Part 3: 5MB  ✅ Uploaded               │                 │
│  │ ...                                    │                 │
│  │ Part 1999: 5MB  ⏳ Pending             │                 │
│  │ Part 2000: 3MB  ⏳ Pending             │                 │
│  └────────────────────────────────────────┘                 │
│                                                              │
│  After Complete:                                            │
│  ┌────────────────────────────────────────┐                 │
│  │ ✅ Final File: movie.mp4 (10GB)        │                 │
│  │ Public URL: https://b2.../movie.mp4    │                 │
│  └────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Request/Response Flow

### Initiate Request

```
┌──────────────────────────────────────┐
│ POST {API}/files/chunk/initiate       │
│                                      │
│ Headers:                             │
│   Authorization: Bearer <token>     │
│   Content-Type: application/json    │
│                                      │
│ Body:                                │
│ {                                    │
│   "originalName": "video.mp4",      │
│   "mimeType": "video/mp4",          │
│   "totalSize": 524288000,           │
│   "totalChunks": 100                │
│ }                                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Response 201 Created                 │
│                                      │
│ {                                    │
│   "success": true,                  │
│   "data": {                         │
│     "uploadId": "xyz123",           │
│     "fileName": "files/...",        │
│     "chunkSize": 5242880            │
│   }                                  │
│ }                                    │
└──────────────────────────────────────┘
```

### Upload Chunk Request

```
┌──────────────────────────────────────┐
│ POST {API}/files/chunk/upload         │
│                                      │
│ Headers:                             │
│   Authorization: Bearer <token>     │
│   Content-Type: multipart/form-data │
│                                      │
│ FormData:                            │
│   uploadId: "xyz123"                │
│   partNumber: "1"                   │
│   chunk: <Binary 5MB blob>          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Response 200 OK                      │
│                                      │
│ {                                    │
│   "success": true,                  │
│   "data": {                         │
│     "partNumber": 1,                │
│     "eTag": "d41d8cd...",           │
│     "uploadedChunks": 1,            │
│     "totalChunks": 100              │
│   }                                  │
│ }                                    │
└──────────────────────────────────────┘
```

### Complete Request

```
┌──────────────────────────────────────┐
│ POST {API}/files/chunk/complete       │
│                                      │
│ Headers:                             │
│   Authorization: Bearer <token>     │
│   Content-Type: application/json    │
│                                      │
│ Body:                                │
│ {                                    │
│   "uploadId": "xyz123"              │
│ }                                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Response 200 OK                      │
│                                      │
│ {                                    │
│   "success": true,                  │
│   "data": {                         │
│     "id": "507f1f77...",            │
│     "fileName": "files/...",        │
│     "fileUrl": "https://...",       │
│     "fileSize": 524288000           │
│   }                                  │
│ }                                    │
└──────────────────────────────────────┘
```

---

## 🧮 Chunk Calculation Examples

### Example 1: 50MB Video

```
File size: 50MB = 52,428,800 bytes
Chunk size: 5MB = 5,242,880 bytes

Total chunks = Math.ceil(52,428,800 / 5,242,880)
             = Math.ceil(10)
             = 10 chunks

Chunk breakdown:
- Chunks 1-9: 5MB each
- Chunk 10: 52,428,800 - (9 × 5,242,880) = 5,242,880 bytes (5MB)
```

### Example 2: 523MB Video

```
File size: 523MB = 548,405,248 bytes
Chunk size: 5MB = 5,242,880 bytes

Total chunks = Math.ceil(548,405,248 / 5,242,880)
             = Math.ceil(104.6)
             = 105 chunks

Chunk breakdown:
- Chunks 1-104: 5MB each
- Chunk 105: 548,405,248 - (104 × 5,242,880) = 3,148,928 bytes (~3MB)
```

### Example 3: 10GB Video

```
File size: 10GB = 10,737,418,240 bytes
Chunk size: 5MB = 5,242,880 bytes

Total chunks = Math.ceil(10,737,418,240 / 5,242,880)
             = Math.ceil(2048)
             = 2048 chunks

Chunk breakdown:
- Chunks 1-2048: 5MB each
- All chunks are exactly 5MB (10GB is divisible by 5MB)
```

---

## ⏱️ Upload Time Estimates

Assuming 10 Mbps upload speed:

| File Size | Chunks | Estimated Time |
| --------- | ------ | -------------- |
| 100MB     | 20     | ~1.5 minutes   |
| 500MB     | 100    | ~7 minutes     |
| 1GB       | 205    | ~14 minutes    |
| 2GB       | 410    | ~28 minutes    |
| 5GB       | 1024   | ~70 minutes    |
| 10GB      | 2048   | ~140 minutes   |

_Note: Actual times vary based on network speed, server load, and B2 performance_

---

## 🚨 Error Scenarios

### Scenario 1: Network Interruption

```
Frontend uploading chunk 45/100
        │
        │ Network drops
        ▼
Upload fails at chunk 45
        │
        │ User refreshes page
        ▼
GET {API}/files/chunk/status/:uploadId
        │
        │ Response: uploadedChunks = 44
        ▼
Resume from chunk 45
```

### Scenario 2: Session Expiration

```
Upload started: Jan 1, 2025 10:00 AM
Session expires: Jan 2, 2025 10:00 AM (24 hours)
        │
        │ User tries to upload chunk on Jan 3
        ▼
Error 404: Upload session not found
        │
        │ Solution: Restart upload
        ▼
POST {API}/files/chunk/initiate (start over)
```

### Scenario 3: Incomplete Upload

```
Total chunks: 100
Uploaded: 95 chunks
        │
        │ User calls COMPLETE
        ▼
Error 400: Not all chunks uploaded
        │
        │ Response: Expected 100, got 95
        ▼
Upload remaining 5 chunks, then complete
```

---

This diagram should help your frontend team visualize the entire upload process!
