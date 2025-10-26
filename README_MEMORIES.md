# 📖 Memories Timeline - Quick Start Guide

## What is this?

The Memorly backend provides:
- **Memories Timeline** - Automatically tracks and displays all user activities in chronological order
- **AI Chat Assistant** - Intelligent memory assistant that helps users recall details and answer questions based on their stored memories
- **Dashboard** - Comprehensive user statistics and recent activities

## 🚀 Quick Start

### 1. For Frontend Developers

**Fetch the Timeline:**
```typescript
const response = await fetch('/memories/timeline?page=1&limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
// data.timeline = activities grouped by date
// data.pagination = pagination info
```

**Complete React Example:**
See `MEMORIES_API_GUIDE.md` for full integration examples including:
- Timeline component with pagination
- Infinite scroll
- Activity type filtering
- Statistics dashboard
- Manual sync

### 2. For Backend Developers

**Understanding the System:**
- Activities are automatically tracked from File, Chat, Message, and Friend models
- The Memory model serves as a cache (auto-synced in background)
- Timeline is built by querying source models directly
- No manual intervention needed

**Read This:**
- `MEMORIES_TIMELINE_IMPLEMENTATION.md` - How it works under the hood

### 3. For Project Managers/QA

**What Gets Tracked:**
- ✅ File uploads (images/videos)
- ✅ Chat creation
- ✅ Messages sent by user
- ✅ Friend requests sent
- ✅ Friend requests accepted
- ✅ Friend requests rejected

**Testing the Feature:**
1. Create some activities (upload file, create chat, etc.)
2. Call `GET /memories/timeline`
3. Verify activities appear in timeline
4. Test pagination with `?page=2`
5. Test filtering with `?activityType=file_upload`

---

## 📁 Documentation Files

| File | For | Contains |
|------|-----|----------|
| `MEMORIES_API_GUIDE.md` | Frontend | Complete API reference + React examples |
| `CHAT_API_GUIDE.md` | Frontend | Chat API integration guide |
| `DASHBOARD_API_GUIDE.md` | Frontend | Dashboard integration guide |
| `AI_CHAT_INTEGRATION.md` | Everyone | AI chat assistant documentation |
| `MEMORIES_TIMELINE_IMPLEMENTATION.md` | Backend | Architecture & technical details |
| `MEMORIES_FEATURE_SUMMARY.md` | Everyone | Feature overview & summary |

---

## 🔑 Key Endpoints

### Get Dashboard (Recommended for Home Screen)
```
GET /memories/dashboard
```
Returns everything: statistics, recent activities, and activity breakdown in one call.

### Get Timeline
```
GET /memories/timeline?page=1&limit=20&activityType=file_upload
```

### Get Statistics
```
GET /memories/stats
```

### Manual Sync (One-time setup)
```
POST /memories/sync
```

---

## ⚙️ First-Time Setup

### After Deploying to Production

If you have existing users with historical data, run a one-time sync:

**Option 1: Via API (Recommended)**
```bash
# For each user, call:
curl -X POST https://your-api.com/memories/sync \
  -H "Authorization: Bearer USER_TOKEN"
```

**Option 2: Manual Script**
```javascript
// Run this in your MongoDB shell or Node.js
const users = await User.find({});
for (const user of users) {
  // Make API call to sync endpoint for each user
}
```

**Note:** After this initial sync, everything is automatic!

---

## 🎯 Common Use Cases

### 1. Display User Timeline
Show users what they've done recently:
```typescript
fetch('/memories/timeline?limit=10')
```

### 2. Show Today's Activities
```typescript
const today = new Date().toISOString().split('T')[0];
fetch(`/memories/date/${today}`)
```

### 3. File Upload History
```typescript
fetch('/memories/timeline?activityType=file_upload')
```

### 4. Activity Statistics
```typescript
fetch('/memories/stats')
// Returns counts by activity type
```

---

## 🐛 Troubleshooting

### Timeline is empty
- Check if user has any activities (files, chats, messages, friends)
- Run manual sync: `POST /memories/sync`
- Check server logs for errors

### Activities missing
- The system auto-syncs on every timeline fetch
- Or manually trigger: `POST /memories/sync`
- Check if activities exist in source models (File, Chat, etc.)

### Slow response
- Use pagination (`?limit=20`)
- Use activity type filter (`?activityType=...`)
- Check database indexes are created

---

## 💡 Tips

### Performance
- Start with `limit=20` for good performance
- Use infinite scroll instead of loading all at once
- Cache recent timeline on frontend

### UX
- Group activities by date (already done in API)
- Show relative dates (Today, Yesterday, etc.)
- Add pull-to-refresh on mobile

### Features
- Add search within timeline
- Export timeline as PDF
- Share memories with friends

---

## 📊 Example Response

```json
{
  "success": true,
  "data": {
    "timeline": [
      {
        "date": "2025-10-26",
        "activities": [
          {
            "id": "123",
            "activityType": "file_upload",
            "metadata": {
              "fileName": "vacation.mp4",
              "fileType": "video",
              "fileUrl": "https://..."
            },
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
      "hasNextPage": true
    }
  }
}
```

---

## 🎨 Activity Type Metadata

Each activity type includes relevant metadata:

**file_upload:**
- fileId, fileName, fileType, fileUrl, fileSize, mimeType

**chat_created:**
- chatId

**message_sent:**
- chatId, messageId, messageText (preview)

**friend_request_sent/accepted/rejected:**
- friendRequestId, friendId, friendUsername

---

## 🚦 Status

- ✅ **READY FOR PRODUCTION**
- ✅ All endpoints tested
- ✅ Documentation complete
- ✅ Auto-sync implemented
- ✅ Performance optimized

---

## 📞 Need Help?

1. **API Questions:** Check `MEMORIES_API_GUIDE.md`
2. **Technical Details:** Check `MEMORIES_TIMELINE_IMPLEMENTATION.md`
3. **Chat Integration:** Check `CHAT_API_GUIDE.md`
4. **Quick Reference:** This file!

---

**Happy coding! 🎉**
