# Memories API - Frontend Integration Guide

This guide explains how to integrate the Memories Timeline API into your frontend application.

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Usage Examples](#usage-examples)
5. [Common Patterns](#common-patterns)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Overview

The Memories API provides a timeline of user activities grouped by date. Activities are automatically tracked when users:
- Upload files (videos/images)
- Create chats
- Send messages
- Send/accept/reject friend requests

All activities are returned in reverse chronological order (newest first) with pagination support.

---

## Authentication

All Memories API endpoints require authentication. Include the JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### 1. Get Dashboard

**Endpoint:** `GET /memories/dashboard`

Retrieves comprehensive dashboard with all user statistics and recent activities in a single request.

**Response:**
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "statistics": {
      "files": {
        "total": 45,
        "images": 30,
        "videos": 15
      },
      "friends": {
        "total": 12,
        "pendingRequests": 3
      },
      "chats": {
        "total": 8
      },
      "messages": {
        "totalSent": 156
      }
    },
    "recentActivities": [
      {
        "type": "file_upload",
        "timestamp": "2025-10-26T14:30:00.000Z",
        "data": {
          "fileName": "vacation.mp4",
          "fileType": "video",
          "fileUrl": "https://..."
        }
      }
    ],
    "activityBreakdown": [
      { "type": "file_upload", "count": 45 },
      { "type": "chat_created", "count": 8 },
      { "type": "message_sent", "count": 156 },
      { "type": "friends", "count": 12 }
    ]
  }
}
```

**See `DASHBOARD_API_GUIDE.md` for complete dashboard integration examples.**

---

### 2. Get Timeline (Paginated)

**Endpoint:** `GET /memories/timeline`

Retrieves user's activity timeline grouped by date with pagination.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number to retrieve |
| `limit` | number | No | 20 | Number of activities per page |
| `activityType` | string | No | - | Filter by specific activity type |

**Activity Types:**
- `file_upload`
- `chat_created`
- `message_sent`
- `friend_request_sent`
- `friend_request_accepted`
- `friend_request_rejected`

**Response:**
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
            "id": "6721abc123def456789012",
            "activityType": "file_upload",
            "metadata": {
              "fileId": "6721abc123def456789013",
              "fileName": "video_1730000000.mp4",
              "fileType": "video",
              "fileUrl": "https://storage.example.com/..."
            },
            "createdAt": "2025-10-26T14:30:00.000Z"
          },
          {
            "id": "6721abc123def456789014",
            "activityType": "friend_request_accepted",
            "metadata": {
              "friendRequestId": "6721abc123def456789015",
              "friendId": "6721abc123def456789016",
              "friendUsername": "john_doe"
            },
            "createdAt": "2025-10-26T10:15:00.000Z"
          }
        ],
        "count": 2
      },
      {
        "date": "2025-10-25",
        "activities": [...],
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

---

### 2. Get Activities by Date

**Endpoint:** `GET /memories/date/:date`

Retrieves all activities for a specific date.

**URL Parameters:**
- `date` (required): Date in `YYYY-MM-DD` format (e.g., `2025-10-26`)

**Response:**
```json
{
  "success": true,
  "message": "Memories retrieved successfully",
  "data": {
    "date": "2025-10-26",
    "activities": [
      {
        "id": "6721abc123def456789012",
        "activityType": "message_sent",
        "metadata": {
          "chatId": "6721abc123def456789017",
          "messageId": "6721abc123def456789018",
          "messageText": "Hello, how are you doing today?"
        },
        "createdAt": "2025-10-26T14:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### 3. Get Activity Statistics

**Endpoint:** `GET /memories/stats`

Retrieves statistics about user's activities.

**Response:**
```json
{
  "success": true,
  "message": "Activity statistics retrieved successfully",
  "data": {
    "total": 195,
    "byType": [
      {
        "activityType": "message_sent",
        "count": 120
      },
      {
        "activityType": "file_upload",
        "count": 45
      },
      {
        "activityType": "friend_request_accepted",
        "count": 20
      },
      {
        "activityType": "chat_created",
        "count": 8
      },
      {
        "activityType": "friend_request_sent",
        "count": 2
      }
    ]
  }
}
```

---

### 4. Sync Memories

**Endpoint:** `POST /memories/sync`

Manually triggers a full sync of all activities to the Memory model. This is useful for:
- Initial setup after deploying the memories feature
- Recovering from sync failures
- Ensuring the Memory model is up-to-date

**Note:** The timeline endpoint automatically syncs missing activities in the background, so this is typically not needed for normal operation.

**Response:**
```json
{
  "success": true,
  "message": "Memories synced successfully",
  "data": {
    "totalActivities": 195,
    "memoriesInDatabase": 195
  }
}
```

---

### 5. Delete Memory

**Endpoint:** `DELETE /memories/:memoryId`

Deletes a specific memory from the timeline.

**URL Parameters:**
- `memoryId` (required): The ID of the memory to delete

**Response:**
```json
{
  "success": true,
  "message": "Memory deleted successfully",
  "data": null
}
```

---

## Usage Examples

### React/TypeScript Example

#### 1. Fetch Timeline with Pagination

```typescript
import { useState, useEffect } from 'react';

interface Activity {
  id: string;
  activityType: string;
  metadata: Record<string, any>;
  createdAt: string;
}

interface TimelineDay {
  date: string;
  activities: Activity[];
  count: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const Timeline = () => {
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTimeline = async (page: number = 1, activityType?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(activityType && { activityType })
      });

      const response = await fetch(`/memories/timeline?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setTimeline(data.data.timeline);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline(currentPage);
  }, [currentPage]);

  const handleNextPage = () => {
    if (pagination?.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination?.hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div>
      {timeline.map(day => (
        <div key={day.date}>
          <h2>{new Date(day.date).toLocaleDateString()}</h2>
          <p>{day.count} activities</p>

          {day.activities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ))}

      {pagination && (
        <div className="pagination">
          <button
            onClick={handlePrevPage}
            disabled={!pagination.hasPreviousPage}
          >
            Previous
          </button>
          <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
          <button
            onClick={handleNextPage}
            disabled={!pagination.hasNextPage}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

#### 2. Filter by Activity Type

```typescript
const FilteredTimeline = () => {
  const [filter, setFilter] = useState<string>('');

  const activityTypes = [
    { value: '', label: 'All Activities' },
    { value: 'file_upload', label: 'File Uploads' },
    { value: 'message_sent', label: 'Messages' },
    { value: 'friend_request_accepted', label: 'Friends Accepted' },
  ];

  return (
    <div>
      <select
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          fetchTimeline(1, e.target.value || undefined);
        }}
      >
        {activityTypes.map(type => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      {/* Timeline component */}
    </div>
  );
};
```

#### 3. Infinite Scroll Implementation

```typescript
import { useEffect, useRef, useCallback } from 'react';

const InfiniteTimeline = () => {
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const observer = useRef<IntersectionObserver>();
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const fetchMoreTimeline = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/memories/timeline?page=${page}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      const data = await response.json();

      if (data.success) {
        setTimeline(prev => [...prev, ...data.data.timeline]);
        setHasMore(data.data.pagination.hasNextPage);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoreTimeline();
  }, [page]);

  return (
    <div>
      {timeline.map((day, index) => (
        <div
          key={day.date}
          ref={index === timeline.length - 1 ? lastElementRef : null}
        >
          <h2>{day.date}</h2>
          {/* Render activities */}
        </div>
      ))}
      {loading && <div>Loading more...</div>}
    </div>
  );
};
```

#### 4. Render Activity Cards

```typescript
const ActivityCard: React.FC<{ activity: Activity }> = ({ activity }) => {
  const renderContent = () => {
    switch (activity.activityType) {
      case 'file_upload':
        return (
          <div className="activity-card">
            <span className="icon">📁</span>
            <div>
              <p>Uploaded a file</p>
              <p className="filename">{activity.metadata.fileName}</p>
              {activity.metadata.fileUrl && (
                <a href={activity.metadata.fileUrl} target="_blank">
                  View file
                </a>
              )}
            </div>
          </div>
        );

      case 'message_sent':
        return (
          <div className="activity-card">
            <span className="icon">💬</span>
            <div>
              <p>Sent a message</p>
              <p className="message-preview">
                {activity.metadata.messageText}
              </p>
            </div>
          </div>
        );

      case 'friend_request_accepted':
        return (
          <div className="activity-card">
            <span className="icon">👥</span>
            <div>
              <p>Became friends with {activity.metadata.friendUsername}</p>
            </div>
          </div>
        );

      case 'chat_created':
        return (
          <div className="activity-card">
            <span className="icon">💬</span>
            <div>
              <p>Started a new chat</p>
            </div>
          </div>
        );

      case 'friend_request_sent':
        return (
          <div className="activity-card">
            <span className="icon">📨</span>
            <div>
              <p>Sent friend request to {activity.metadata.friendUsername}</p>
            </div>
          </div>
        );

      case 'friend_request_rejected':
        return (
          <div className="activity-card">
            <span className="icon">❌</span>
            <div>
              <p>Declined friend request from {activity.metadata.friendUsername}</p>
            </div>
          </div>
        );

      default:
        return <div>Unknown activity</div>;
    }
  };

  return (
    <div className="activity-wrapper">
      {renderContent()}
      <span className="timestamp">
        {new Date(activity.createdAt).toLocaleTimeString()}
      </span>
    </div>
  );
};
```

#### 5. Delete Memory

```typescript
const deleteMemory = async (memoryId: string) => {
  try {
    const response = await fetch(`/memories/${memoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      }
    });

    const data = await response.json();

    if (data.success) {
      // Remove from local state
      setTimeline(prev =>
        prev.map(day => ({
          ...day,
          activities: day.activities.filter(a => a.id !== memoryId)
        }))
      );
    }
  } catch (error) {
    console.error('Error deleting memory:', error);
  }
};
```

#### 6. Activity Statistics Dashboard

```typescript
import { Pie } from 'react-chartjs-2';

const ActivityStats = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const response = await fetch('/memories/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    };

    fetchStats();
  }, []);

  if (!stats) return <div>Loading stats...</div>;

  const chartData = {
    labels: stats.byType.map((t: any) => t.activityType),
    datasets: [{
      data: stats.byType.map((t: any) => t.count),
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
      ]
    }]
  };

  return (
    <div>
      <h2>Activity Statistics</h2>
      <p>Total Activities: {stats.total}</p>
      <Pie data={chartData} />
    </div>
  );
};
```

---

#### 7. Manual Sync Memories

```typescript
const SyncMemories = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch('/memories/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setSyncResult(data.data);
      }
    } catch (error) {
      console.error('Error syncing memories:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="sync-section">
      <h3>Sync Memories</h3>
      <p>Ensure all your activities are properly tracked in the memories system.</p>

      <button onClick={handleSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>

      {syncResult && (
        <div className="sync-result">
          <p>✅ Sync completed successfully!</p>
          <p>Total Activities: {syncResult.totalActivities}</p>
          <p>Memories in Database: {syncResult.memoriesInDatabase}</p>
        </div>
      )}
    </div>
  );
};
```

---

### Vanilla JavaScript Example

```javascript
// Fetch timeline
async function fetchTimeline(page = 1) {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/memories/timeline?page=${page}&limit=20`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      renderTimeline(data.data.timeline);
      renderPagination(data.data.pagination);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Render timeline
function renderTimeline(timeline) {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  timeline.forEach(day => {
    const dayElement = document.createElement('div');
    dayElement.className = 'timeline-day';

    const dateHeader = document.createElement('h2');
    dateHeader.textContent = new Date(day.date).toLocaleDateString();
    dayElement.appendChild(dateHeader);

    day.activities.forEach(activity => {
      const activityCard = createActivityCard(activity);
      dayElement.appendChild(activityCard);
    });

    container.appendChild(dayElement);
  });
}

// Create activity card
function createActivityCard(activity) {
  const card = document.createElement('div');
  card.className = 'activity-card';
  card.innerHTML = `
    <div class="activity-content">
      ${getActivityContent(activity)}
    </div>
    <span class="timestamp">${new Date(activity.createdAt).toLocaleTimeString()}</span>
  `;
  return card;
}

function getActivityContent(activity) {
  switch(activity.activityType) {
    case 'file_upload':
      return `
        <span class="icon">📁</span>
        <p>Uploaded: ${activity.metadata.fileName}</p>
      `;
    case 'message_sent':
      return `
        <span class="icon">💬</span>
        <p>${activity.metadata.messageText}</p>
      `;
    case 'friend_request_accepted':
      return `
        <span class="icon">👥</span>
        <p>Became friends with ${activity.metadata.friendUsername}</p>
      `;
    default:
      return `<p>${activity.activityType}</p>`;
  }
}
```

---

## Common Patterns

### 1. Calendar View Integration

Get activities for a specific date when user clicks on a calendar date:

```typescript
const handleDateClick = async (date: Date) => {
  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

  const response = await fetch(`/memories/date/${dateString}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });

  const data = await response.json();
  // Display activities for that date
};
```

### 2. Activity Type Badges

Show visual indicators for different activity types:

```typescript
const activityTypeConfig = {
  file_upload: { icon: '📁', color: '#3B82F6', label: 'File Upload' },
  chat_created: { icon: '💬', color: '#10B981', label: 'Chat Created' },
  message_sent: { icon: '✉️', color: '#8B5CF6', label: 'Message Sent' },
  friend_request_sent: { icon: '📨', color: '#F59E0B', label: 'Request Sent' },
  friend_request_accepted: { icon: '✅', color: '#10B981', label: 'Request Accepted' },
  friend_request_rejected: { icon: '❌', color: '#EF4444', label: 'Request Rejected' },
};

const ActivityBadge = ({ type }) => {
  const config = activityTypeConfig[type];
  return (
    <span style={{ backgroundColor: config.color }}>
      {config.icon} {config.label}
    </span>
  );
};
```

### 3. Pull-to-Refresh

```typescript
const TimelineWithRefresh = () => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTimeline(1);
    setRefreshing(false);
  };

  return (
    <div onPull={handleRefresh}>
      {refreshing && <div>Refreshing...</div>}
      {/* Timeline content */}
    </div>
  );
};
```

---

## Error Handling

### Handle Common Errors

```typescript
const fetchTimeline = async () => {
  try {
    const response = await fetch('/memories/timeline', {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (response.status === 401) {
      // Unauthorized - redirect to login
      window.location.href = '/login';
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      // Handle API error
      showError(data.message || 'Failed to fetch timeline');
      return;
    }

    // Success
    setTimeline(data.data.timeline);

  } catch (error) {
    console.error('Error fetching timeline:', error);
    showError('Network error. Please check your connection.');
  }
};
```

---

## Best Practices

### 1. Caching Strategy

```typescript
// Cache timeline data to reduce API calls
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedTimeline = () => {
  const cached = localStorage.getItem('timeline_cache');
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > CACHE_DURATION) {
    return null;
  }

  return data;
};

const setCachedTimeline = (data: any) => {
  localStorage.setItem('timeline_cache', JSON.stringify({
    data,
    timestamp: Date.now()
  }));
};
```

### 2. Optimistic Updates

When deleting a memory, update UI immediately:

```typescript
const deleteMemory = async (memoryId: string) => {
  // Optimistically remove from UI
  const previousTimeline = [...timeline];
  setTimeline(prev =>
    prev.map(day => ({
      ...day,
      activities: day.activities.filter(a => a.id !== memoryId)
    }))
  );

  try {
    const response = await fetch(`/memories/${memoryId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      // Revert on error
      setTimeline(previousTimeline);
      showError('Failed to delete memory');
    }
  } catch (error) {
    // Revert on error
    setTimeline(previousTimeline);
    showError('Network error');
  }
};
```

### 3. Date Formatting

Use consistent date formatting:

```typescript
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};
```

### 4. Loading States

Show appropriate loading states:

```typescript
const Timeline = () => {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);

  if (loading) {
    return <TimelineSkeleton />;
  }

  if (timeline.length === 0) {
    return (
      <div className="empty-state">
        <h3>No activities yet</h3>
        <p>Start using the app to see your timeline!</p>
      </div>
    );
  }

  return (/* timeline content */);
};
```

### 5. Performance Optimization

```typescript
// Virtualize long lists
import { FixedSizeList } from 'react-window';

const VirtualizedTimeline = () => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ActivityCard activity={allActivities[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={allActivities.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

---

## Response Metadata Reference

### Activity Type Metadata

Each activity type includes specific metadata:

**file_upload:**
```typescript
{
  fileId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
}
```

**chat_created:**
```typescript
{
  chatId: string;
}
```

**message_sent:**
```typescript
{
  chatId: string;
  messageId: string;
  messageText: string; // First 100 characters
}
```

**friend_request_sent/accepted/rejected:**
```typescript
{
  friendRequestId: string;
  friendId: string;
  friendUsername: string;
}
```

---

## Testing Tips

### 1. Test with Mock Data

```typescript
const mockTimeline = {
  success: true,
  data: {
    timeline: [
      {
        date: "2025-10-26",
        activities: [
          {
            id: "1",
            activityType: "file_upload",
            metadata: {
              fileName: "test.mp4",
              fileType: "video"
            },
            createdAt: new Date().toISOString()
          }
        ],
        count: 1
      }
    ],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalCount: 1,
      limit: 20,
      hasNextPage: false,
      hasPreviousPage: false
    }
  }
};
```

### 2. Test Edge Cases

- Empty timeline
- Single activity
- Large number of activities (pagination)
- Very long text in message_sent
- Missing metadata fields
- Network errors
- 401 Unauthorized

---

## Support

For questions or issues, please refer to the main API documentation or contact the backend team.
