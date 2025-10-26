# Memories Timeline Implementation Notes

## Overview

The Memories Timeline feature has been updated to aggregate activities from **all relevant data sources** in the database, not just the Memory model. This ensures that even if memory tracking fails or wasn't implemented at some point, all user activities are still captured and displayed in the timeline.

## How It Works

### Data Sources

The `getMemoriesTimeline` endpoint aggregates data from the following sources:

1. **File Model** → `file_upload` activities
   - Fetches all files uploaded by the user
   - Includes: fileName, fileType, fileUrl, fileSize, mimeType

2. **Chat Model** → `chat_created` activities
   - Fetches all chats created by the user
   - Includes: chatId

3. **Message Model** → `message_sent` activities
   - Fetches all user messages (senderType = "user" only)
   - Includes: chatId, messageId, message preview (first 100 chars)

4. **Friend Model** → Friend request activities
   - `friend_request_sent`: All friend requests sent by the user
   - `friend_request_accepted`: Friend requests the user accepted
   - `friend_request_rejected`: Friend requests the user rejected
   - Includes: friendRequestId, friendId, friendUsername, status

### Benefits of This Approach

✅ **No Data Loss**: Even if the memory creation helper fails, activities are still tracked through their original models

✅ **Accurate Timeline**: The timeline always reflects the actual state of the database

✅ **Real-time Sync**: No need to manually sync or backfill the Memory model

✅ **Performance**: Uses lean() queries and parallel fetching for optimal performance

✅ **Filter Support**: Activity type filters work across all data sources

## Memory Model Status & Auto-Sync

The `Memory` model serves as a **cache and backup** for timeline data:

### Automatic Background Sync

Every time a user fetches their timeline, the system automatically:
1. Queries all activity models (File, Chat, Message, Friend)
2. Compares with existing Memory records
3. Identifies missing activities
4. Syncs missing activities to Memory model in the background (non-blocking)

This ensures:
- ✅ The Memory model stays up-to-date automatically
- ✅ No manual intervention required
- ✅ Gradual sync happens during normal usage
- ✅ Zero impact on API response time (runs after response is sent)

### Manual Sync Endpoint

A manual sync endpoint is also available: `POST /memories/sync`

Use this for:
- Initial setup after deploying the feature
- Bulk sync of historical data
- Recovery from sync failures
- Admin/maintenance tasks

The Memory model provides:
- Faster queries in the future (single collection vs multiple)
- Redundancy and backup
- Analytics and reporting capabilities
- Ability to query memories independently

However, the Memory model is **not the source of truth** - the timeline is always built dynamically from actual activity models to ensure accuracy.

## Timeline Aggregation Flow

```
User Request
    ↓
getMemoriesTimeline()
    ↓
┌─────────────────────────────────────┐
│  Parallel Fetch (if not filtered)  │
├─────────────────────────────────────┤
│  1. Files (uploadedAt)              │
│  2. Chats (createdAt)               │
│  3. Messages (createdAt, user only) │
│  4. Friend Requests Sent            │
│  5. Friend Requests Accepted        │
│  6. Friend Requests Rejected        │
└─────────────────────────────────────┘
    ↓
Merge into single array
    ↓
Sort by createdAt (newest first)
    ↓
Apply pagination (skip, limit)
    ↓
Group by date (YYYY-MM-DD)
    ↓
Return timeline + pagination info
```

## API Endpoint Details

### GET /memories/timeline

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `activityType` (optional): Filter by specific activity type

**Response Structure:**
```json
{
  "success": true,
  "message": "Timeline retrieved successfully",
  "data": {
    "timeline": [
      {
        "date": "2025-10-26",
        "activities": [
          {
            "id": "...",
            "activityType": "file_upload",
            "metadata": { ... },
            "createdAt": "2025-10-26T14:30:00.000Z"
          }
        ],
        "count": 5
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalCount": 195,
      "limit": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

## Activity Type Metadata

Each activity type includes specific metadata from its source model:

### file_upload
```typescript
{
  fileId: ObjectId,
  fileName: string,
  originalName: string,
  fileType: "image" | "video",
  fileUrl: string,
  fileSize: number,
  mimeType: string
}
```

### chat_created
```typescript
{
  chatId: ObjectId
}
```

### message_sent
```typescript
{
  chatId: ObjectId,
  messageId: ObjectId,
  messageText: string  // First 100 characters
}
```

### friend_request_sent
```typescript
{
  friendRequestId: ObjectId,
  friendId: ObjectId,
  friendUsername: string,
  status: "pending" | "accepted" | "rejected"
}
```

### friend_request_accepted
```typescript
{
  friendRequestId: ObjectId,
  friendId: ObjectId,
  friendUsername: string
}
```

### friend_request_rejected
```typescript
{
  friendRequestId: ObjectId,
  friendId: ObjectId,
  friendUsername: string
}
```

## Statistics Endpoint

### GET /memories/stats

Also updated to aggregate from all sources:

```json
{
  "success": true,
  "message": "Activity statistics retrieved successfully",
  "data": {
    "total": 195,
    "byType": [
      { "activityType": "file_upload", "count": 45 },
      { "activityType": "chat_created", "count": 8 },
      { "activityType": "message_sent", "count": 120 },
      { "activityType": "friend_request_sent", "count": 15 },
      { "activityType": "friend_request_accepted", "count": 5 },
      { "activityType": "friend_request_rejected", "count": 2 }
    ]
  }
}
```

## Performance Considerations

### Optimizations Applied

1. **Conditional Fetching**: Only fetches from models that match the activity type filter
2. **Lean Queries**: Uses `.lean()` to return plain JavaScript objects instead of Mongoose documents
3. **Parallel Fetching**: Uses `Promise.all()` for statistics to fetch counts in parallel
4. **Indexed Queries**: All models have indexes on userId and timestamp fields
5. **In-Memory Sorting**: Sorts activities in memory after fetching (faster than DB sorting across collections)

### Potential Future Optimizations

If the timeline becomes slow with large datasets:

1. **Implement pagination at DB level**: Fetch only the date range needed
2. **Add caching**: Cache recent timeline pages with Redis
3. **Add date range filters**: Allow filtering by date to reduce result set
4. **Aggregate pipeline**: Use MongoDB aggregation pipeline to merge collections
5. **Background sync**: Optionally sync to Memory model in background for faster queries

## Migration Notes

### For Existing Data

If you already have data in the database before implementing memory tracking:

✅ **No migration needed!** The timeline will automatically include all historical activities from their original models.

### Removing Memory Tracking

If you want to remove the memory tracking helper calls from controllers in the future:

✅ **Safe to remove!** The timeline will continue to work since it reads from the original models.

## Testing

### Test Cases

1. **Empty Timeline**: User with no activities
2. **File Uploads Only**: User who only uploaded files
3. **Mixed Activities**: User with all activity types
4. **Large Dataset**: User with 1000+ activities (test pagination)
5. **Activity Type Filter**: Filter by each activity type
6. **Edge Cases**:
   - Friend requests with deleted users (should handle populate gracefully)
   - Messages in deleted chats
   - Pagination edge cases (first page, last page)

### Test Data Example

```javascript
// Create test user with mixed activities
const testUser = await User.create({ ... });

// Upload files
await File.create({ userId: testUser._id, ... });

// Create chats
const chat = await Chat.create({ userId: testUser._id });

// Send messages
await Message.create({ userId: testUser._id, chatId: chat._id, ... });

// Friend requests
await Friend.create({ senderId: testUser._id, receiverId: otherUser._id });

// Fetch timeline
const timeline = await fetch('/memories/timeline');
```

## Error Handling

The endpoint handles:

- ✅ Missing/deleted referenced users (populate returns null)
- ✅ Invalid activity type filters (returns empty array)
- ✅ Large result sets (pagination)
- ✅ Database connection errors (returns 500)
- ✅ Unauthorized access (returns 401)

## Conclusion

This implementation ensures the timeline is always accurate and complete by directly querying the source models rather than relying solely on a separate memory tracking system. This makes the system more robust and eliminates potential sync issues.
