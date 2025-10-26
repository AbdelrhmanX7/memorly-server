# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memorly is a **memory tracking and AI-powered chat application backend** built with Express.js, TypeScript, and MongoDB. The application features file uploads (images/videos) with chunked upload support, an AI chat assistant powered by Google Gemini, friend system, and an activity timeline that aggregates user activities across the platform.

## Development Commands

### Development Server
```bash
yarn dev
```
Runs the development server with hot-reload using `ts-node-dev`. Automatically loads environment variables from `.env` file.

### Build
```bash
yarn build
```
Compiles TypeScript to JavaScript using `tsc` and resolves path aliases with `tsc-alias`. Output goes to `dist/` directory.

### Production Deployment
```bash
yarn prod-start    # Initial deployment with PM2
yarn reload-prod   # Rebuild and reload without downtime
```
Uses PM2 process manager with the name `memorly`. The process will automatically load environment variables from `.env` file.

## Architecture

### High-Level Application Flow

```
User Request → Middleware (Auth/Upload) → Routes → Controllers → Services/Utils → Models → Database
                                                        ↓
                                                   External Services
                                                   (Backblaze B2, Gemini AI, Email)
```

### Core Features

1. **Authentication & User Management**
   - JWT-based authentication with 30-day expiry
   - Email verification via OTP (10-minute expiry with MongoDB TTL index)
   - Password reset flow with OTP
   - User registration with age verification (min 13 years) and privacy policy acceptance

2. **File Management with Dual Upload Strategy**
   - **Direct uploads**: Images and small videos (up to 100MB) → Backblaze B2
   - **Chunked uploads**: Large videos (up to 10GB) via S3-compatible multipart upload API
   - Unique filename generation: `timestamp-randomhex.ext`
   - Automatic cleanup of expired chunked uploads (24-hour TTL, cleaned every 6 hours)

3. **AI-Powered Chat System**
   - **Streaming AI responses**: Server-Sent Events (SSE) for real-time response streaming
   - External LLM service integration with memory-aware context retrieval
   - Two-step message flow: `/message/create` for manual messages, `/generate` for AI responses
   - Memory-aware responses using retrieved context from files and messages
   - Graceful error handling with fallback error streams

4. **Friend System**
   - Friend requests with state machine: `null → pending → accepted/rejected`
   - Auto-blocking on rejection
   - User search functionality
   - Bidirectional relationship tracking

5. **Memory Timeline & Dashboard**
   - **Critical Pattern**: Timeline queries ALL source models (File, Chat, Message, Friend), NOT just Memory model
   - Memory model acts as activity cache with background sync
   - Pagination and filtering by activity type
   - Dashboard with statistics and recent activities

### Database Models and Relationships

```
User (Core Entity)
├── Files (1:N) - User uploads stored in Backblaze B2
├── Chats (1:N) - Chat sessions
│   └── Messages (1:N) - Messages with senderType: 'user' | 'system' (AI)
├── Friends (N:N) - Friend relationships with status tracking
│   └── BlockedUsers (1:N) - Blocked relationships (auto-created on rejection)
├── OTPs (1:N) - Verification codes with TTL index (auto-expire after 10 min)
├── ChunkUploads (1:N) - Multipart upload session state
└── Memories (1:N) - Activity timeline cache
```

**Key Model Patterns:**

- **User Model** (`src/models/user.ts`):
  - Password hashing via bcrypt pre-save hook (10 salt rounds)
  - Custom `comparePassword` method for authentication
  - Password field excluded from all query results

- **Memory Model** (`src/models/memory.ts`):
  - Acts as **unified activity aggregation cache**
  - Activity types: `file_upload`, `chat_created`, `message_sent`, `friend_request_sent/accepted/rejected`
  - Flexible metadata schema (Schema.Types.Mixed)
  - Compound indexes: `userId + createdAt`, `userId + activityType + createdAt`
  - **IMPORTANT**: Timeline queries source models first, then syncs to Memory in background

- **ChunkUpload Model** (`src/models/chunk-upload.ts`):
  - Tracks S3 multipart upload state and uploaded parts (with ETags)
  - Status: `initiated → uploading → completed/failed/aborted`
  - Auto-expiry after 24 hours
  - Enables resumable uploads

- **OTP Model** (`src/models/otp.ts`):
  - MongoDB TTL index for auto-deletion (10 minutes)
  - Types: `email_verification`, `password_reset`

### Critical Implementation Patterns

#### Pattern 1: Memory Tracking System

**Non-blocking memory creation across the app:**

```typescript
// In any controller after creating a record
await createMemory({
  userId,
  activityType: "file_upload",  // or chat_created, message_sent, etc.
  metadata: { fileId, fileName, ... }
});
// IMPORTANT: Never throws errors - wrapped in try-catch, logs errors but continues
```

**Timeline Aggregation Strategy:**

The `getMemoriesTimeline()` controller queries ALL source models in parallel:
```
1. File.find({ userId }) → file_upload activities
2. Chat.find({ userId }) → chat_created activities
3. Message.find({ userId, senderType: "user" }) → message_sent activities
4. Friend.find({ $or: [senderId, receiverId] }) → friend request activities
5. Combine → Sort by date → Paginate → Group by date
6. Background sync to Memory model (non-blocking)
```

**Why this approach?**
- Ensures accuracy (source of truth is source models)
- Handles historical data that may not be in Memory model
- Background sync keeps Memory model updated for future optimizations

#### Pattern 2: Chunked Upload Flow

Large video uploads use a multi-step process:

```
1. POST /files/chunk/initiate
   → Creates S3 multipart upload
   → Returns uploadId and chunkSize (5MB)

2. POST /files/chunk/upload (repeated for each chunk)
   → Uploads chunk to S3
   → Stores ETag in ChunkUpload.parts array

3. POST /files/chunk/complete
   → Combines all parts in S3
   → Creates File record
   → Creates memory entry
   → Returns file URL

Cleanup: Background service runs every 6 hours
   → Finds expired ChunkUploads (>24h)
   → Aborts S3 multipart upload
   → Deletes ChunkUpload record
```

**Key constants** (in `src/utils/chunk-upload.service.ts`):
- `CHUNK_SIZE`: 5MB (S3 minimum for multipart)
- `MAX_VIDEO_SIZE`: 10GB
- Expiry: 24 hours

#### Pattern 3: AI Chat Integration

**Streaming SSE flow:**

```
User sends message to /chat/generate
  ↓
Save user message to DB
  ↓
Call external LLM service (MEMORLY_INTERNAL_TOOLS_API)
  ├─ Service retrieves context (files + messages from MongoDB)
  ├─ Service builds memory-aware prompt
  ├─ Service generates response with LLM
  └─ Returns streaming response
  ↓
Pipe stream to client as Server-Sent Events (SSE)
  ├─ type: "metadata" - Context sources used
  ├─ type: "chunk" - Response text chunks (streamed in real-time)
  ├─ type: "done" - Processing complete with timing info
  └─ type: "error" - Error message if generation fails
```

**SSE Response format:**
```
data: {"type": "metadata", "data": {"sources": [...]}}

data: {"type": "chunk", "data": "Based on your memories"}

data: {"type": "chunk", "data": ", you visited..."}

data: {"type": "done", "data": {"processing_time": 2.5}}
```

**Alternative: Manual message creation:**
Use `POST /chat/message/create` to create messages without AI response (for system messages or direct user messages).

**External LLM Service:**
- Endpoint configured via `MEMORLY_INTERNAL_TOOLS_API` environment variable
- Service handles memory retrieval and AI generation
- 120-second timeout for streaming responses
- Graceful fallback to error streams on service unavailability

#### Pattern 4: Friend Request State Machine

```
null state (no relationship)
  ↓
pending (request sent)
  ↓
accepted ────→ friends
  ↓
rejected ────→ BlockedUser created
```

**Key behaviors:**
- Rejecting a friend request automatically creates a BlockedUser entry
- Blocked users cannot send new friend requests
- Bidirectional queries check both senderId and receiverId
- Prevents self-friending

### Route Organization

**Main Router Structure** (`src/routes/index.ts`):

```
/
├── /auth              # Registration, login, OTP verification, password reset
├── /docs              # API documentation (Swagger UI at /api-docs)
├── /files             # File uploads
│   ├── POST /upload           # Direct upload (up to 100MB)
│   └── /chunk                 # Chunked upload endpoints
│       ├── POST /initiate     # Start multipart upload
│       ├── POST /upload       # Upload single chunk
│       ├── POST /complete     # Finalize upload
│       ├── POST /abort        # Cancel upload
│       └── GET /status/:id    # Check progress
├── /chat              # Chat and messages
│   ├── POST /create           # Create chat
│   ├── POST /message/create   # Send message (manual, no AI response)
│   ├── POST /generate         # Generate AI response with streaming (SSE)
│   ├── GET /:chatId/messages  # Get chat history
│   └── DELETE /message/:id    # Delete message
├── /friends           # Friend management
│   ├── POST /request          # Send friend request
│   ├── POST /accept           # Accept request
│   ├── POST /reject           # Reject request (auto-blocks)
│   ├── GET /list              # Get friends
│   └── GET /search            # Search users
└── /memories          # Timeline and dashboard
    ├── GET /dashboard         # Stats + recent activities (recommended for home screen)
    ├── GET /timeline          # Paginated timeline with filtering
    ├── GET /stats             # Activity statistics
    └── POST /sync             # Manual memory sync
```

### Controller Pattern

All controllers follow this consistent structure:

```typescript
export const controllerName = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      handleError({ res, error: new Error("User not authenticated"), statusCode: 401 });
      return;
    }

    // Validate input
    // Business logic
    // Create memory (if applicable)

    res.status(200).json({
      success: true,
      message: "Success message",
      data: { ... }
    });
  } catch (error: unknown) {
    console.error("Error description:", error);
    handleError({ res, error: error as Error, statusCode: 500 });
  }
};
```

**Standard response format:**
```typescript
{ success: boolean, message: string, data?: any }
```

### Middleware

**Authentication Middleware** (`src/middleware/auth.middleware.ts`):
```
Extract Bearer token → Verify JWT → Attach user info to req.user → Next
```
Attaches `{ userId: string, email: string }` to `req.user` for downstream use.

**Upload Middleware** (`src/middleware/upload.middleware.ts`):

Two strategies:
1. **Regular upload**: Memory storage, 100MB limit, filters images/videos
2. **Chunked upload**: 10MB per chunk, no filtering (handled in controller)

### Key Utilities and Services

**File Service** (`src/utils/file.service.ts`):
- `uploadToB2(file, userId)` - Upload to Backblaze B2 using S3 SDK
- `deleteFromB2(fileUrl)` - Delete from storage
- `validateFileType(mimeType)` - MIME validation for images/videos
- Unique filename: `Date.now()-${crypto.randomBytes(8).toString('hex')}.${ext}`
- Sets cache headers (1 year) and content type

**Chunk Upload Service** (`src/utils/chunk-upload.service.ts`):
- `initiateChunkedUpload(fileName, fileSize, userId)` - Start S3 multipart
- `uploadChunk(uploadId, chunkNumber, buffer)` - Upload part, returns ETag
- `completeChunkedUpload(uploadId, userId)` - Finalize, create File record
- `abortChunkedUpload(uploadId)` - Cancel upload
- `cleanupExpiredUploads()` - Delete expired sessions (called by cleanup service)

**AI Chat Service** (`src/services/ai-chat.service.ts`):
- `generateAIResponseStream(userId, userQuery, limit)` - Main streaming function
- Makes HTTP POST to external LLM service at `${MEMORLY_INTERNAL_TOOLS_API}/generate`
- Returns readable stream for Server-Sent Events
- Includes error handling with fallback error streams
- 120-second timeout for LLM service responses
- NOTE: Memory retrieval and AI generation handled by external service

**Email Service** (`src/utils/email.service.ts`):
- `sendVerificationEmail(email, otp)` - Email verification OTP
- `sendPasswordResetEmail(email, otp)` - Password reset OTP
- Nodemailer transporter with HTML templates

**Memory Helper** (`src/utils/memory.helper.ts`):
- `createMemory({ userId, activityType, metadata })` - Single creation function
- Wrapped in try-catch, never throws
- Used consistently across all controllers

### Configuration

**Required Environment Variables:**

```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/memorly

# Authentication
JWT_SECRET=your_jwt_secret

# Backblaze B2 (S3-compatible)
B2_KEY_ID=your_key_id
B2_APP_KEY=your_app_key
B2_BUCKET=your_bucket_name
B2_REGION=us-west-000
B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
GOOGLE_APP_PASSWORD=your_app_password
EMAIL_FROM_NAME=Memorly

# AI
GEMINI_API_KEY=your_gemini_api_key
MEMORLY_INTERNAL_TOOLS_API=http://localhost:5000  # External LLM service endpoint

# Server
PORT=4000
```

**Config Files:**
- `src/config/db.ts` - MongoDB connection
- `src/config/backblaze.ts` - S3 client with path-style access for B2 compatibility
- `src/config/gemini.ts` - GoogleGenAI initialization
- `src/config/swagger.ts` - API documentation

### Background Services

**Cleanup Service** (`src/services/cleanup.service.ts`):

Started at application boot in `src/index.ts`:
```typescript
startPeriodicCleanup(6)  // Runs every 6 hours
```

Calls `cleanupExpiredUploads()` to:
1. Find ChunkUploads older than 24 hours
2. Abort multipart upload in S3
3. Delete ChunkUpload record from database

### TypeScript Type System

**Express Request Augmentation** (`src/types/express.d.ts`):
```typescript
export interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}
```

**Global Type Augmentation** (`src/types/global.d.ts`):
```typescript
declare global {
  var ai: GoogleGenAI;      // Gemini AI instance
  var io: SocketIOServer;   // For future Socket.IO integration
}
```

### Important Implementation Notes

**Memory Creation:**
- Always use `createMemory()` helper from `src/utils/memory.helper.ts`
- Never manually create Memory documents
- Helper never throws errors - safe to call without try-catch

**Timeline Queries:**
- ALWAYS query source models first (File, Chat, Message, Friend)
- Use Memory model only for optimization or filtering
- Background sync happens automatically in `getMemoriesTimeline()`

**File Upload Size Limits:**
- Images: 10MB (direct upload)
- Small videos: 100MB (direct upload)
- Large videos: 10GB (chunked upload)

**AI Response Behavior:**
- Streaming responses via Server-Sent Events (SSE) for real-time updates
- User message saved immediately, AI response streams afterward
- Average response time: 2-5 seconds (streamed in chunks)
- Failed AI responses return error stream with error type and message
- Requires external LLM service running at `MEMORLY_INTERNAL_TOOLS_API`

**Friend Request Flow:**
- Check for blocked users before allowing friend requests
- Rejection automatically creates BlockedUser entry
- Cannot send multiple pending requests to same user

**Database Indexes:**
- All user-scoped models have `userId` index
- Compound indexes for common query patterns
- TTL index on OTP model (10-minute auto-expiry)
- Sparse indexes where applicable

### API Documentation

Swagger UI available at `/api-docs` after server start.

Route documentation uses JSDoc comments in router files.

### Security Patterns

- JWT tokens with 30-day expiry
- Bcrypt password hashing (10 salt rounds)
- User-scoped queries (always filter by userId)
- Ownership verification before updates/deletes
- Input validation with Joi schemas (`src/validation/`)
- Error messages sanitized (no stack traces to client)
- Environment variable validation at startup

### Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Dev server auto-reloads** (via `ts-node-dev`)
3. **Build for production** with `yarn build`
4. **Deploy** with `yarn prod-start` or `yarn reload-prod` (zero-downtime reload)

**Path Aliases:**
- Configured in `tsconfig.json`
- Resolved with `tsc-alias` during build
- Example: `@/models/user` → `src/models/user`

### Future Enhancements (TODOs in code)

- Vector database integration for semantic memory search (handled by external LLM service)
- Socket.IO for bidirectional real-time updates (SSE currently provides server-to-client streaming)
- Batch operations for memory sync
- Image/video analysis for AI context (OCR, object detection)
- AI response persistence to database (currently only streamed, not saved)
