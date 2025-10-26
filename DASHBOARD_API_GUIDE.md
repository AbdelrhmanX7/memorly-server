# Dashboard API - Frontend Integration Guide

Complete guide for integrating the user dashboard with statistics and recent activities.

## Table of Contents
1. [Overview](#overview)
2. [API Endpoint](#api-endpoint)
3. [Response Structure](#response-structure)
4. [Usage Examples](#usage-examples)
5. [UI Components](#ui-components)
6. [Best Practices](#best-practices)

---

## Overview

The Dashboard API provides a comprehensive overview of user activity in a single API call:
- **File statistics** (images, videos, total uploads)
- **Friend statistics** (total friends, pending requests)
- **Chat statistics** (total chats)
- **Message statistics** (total messages sent)
- **Recent activities** (last 10 activities across all types)
- **Activity breakdown** (counts by type)

**Single Endpoint:** `GET /memories/dashboard`

---

## API Endpoint

### Get Dashboard

**Endpoint:** `GET /memories/dashboard`

**Authentication:** Required (Bearer token)

**Request:**
```javascript
fetch('/memories/dashboard', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
})
```

**Response:** `200 OK`
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
      },
      {
        "type": "message_sent",
        "timestamp": "2025-10-26T13:15:00.000Z",
        "data": {
          "chatId": "6721abc...",
          "text": "Hello, how are you?"
        }
      },
      {
        "type": "friend_added",
        "timestamp": "2025-10-26T10:00:00.000Z",
        "data": {
          "friendUsername": "john_doe",
          "friendId": "6721def..."
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

---

## Response Structure

### Statistics Object

```typescript
interface DashboardStatistics {
  files: {
    total: number;      // Total files uploaded
    images: number;     // Total images
    videos: number;     // Total videos
  };
  friends: {
    total: number;           // Total accepted friends
    pendingRequests: number; // Pending friend requests received
  };
  chats: {
    total: number;      // Total chats created
  };
  messages: {
    totalSent: number;  // Total messages sent by user
  };
}
```

### Recent Activities

Array of the last 10 activities across all types, sorted by timestamp (newest first).

**Activity Types:**

#### file_upload
```typescript
{
  type: "file_upload",
  timestamp: string,
  data: {
    fileName: string,
    fileType: "image" | "video",
    fileUrl: string
  }
}
```

#### message_sent
```typescript
{
  type: "message_sent",
  timestamp: string,
  data: {
    chatId: string,
    text: string  // First 100 characters
  }
}
```

#### chat_created
```typescript
{
  type: "chat_created",
  timestamp: string,
  data: {
    chatId: string
  }
}
```

#### friend_added
```typescript
{
  type: "friend_added",
  timestamp: string,
  data: {
    friendUsername: string,
    friendId: string
  }
}
```

### Activity Breakdown

Array of activity counts by type (only includes types with count > 0):

```typescript
interface ActivityBreakdown {
  type: "file_upload" | "chat_created" | "message_sent" | "friends";
  count: number;
}
```

---

## Usage Examples

### React/TypeScript Implementation

#### 1. Complete Dashboard Component

```typescript
import { useState, useEffect } from 'react';

interface DashboardData {
  statistics: {
    files: { total: number; images: number; videos: number };
    friends: { total: number; pendingRequests: number };
    chats: { total: number };
    messages: { totalSent: number };
  };
  recentActivities: Array<{
    type: string;
    timestamp: string;
    data: any;
  }>;
  activityBreakdown: Array<{
    type: string;
    count: number;
  }>;
}

const Dashboard = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/memories/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setDashboard(result.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!dashboard) {
    return <div>Failed to load dashboard</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Statistics Grid */}
      <div className="stats-grid">
        <StatCard
          title="Files"
          value={dashboard.statistics.files.total}
          subtitle={`${dashboard.statistics.files.images} images, ${dashboard.statistics.files.videos} videos`}
          icon="📁"
        />
        <StatCard
          title="Friends"
          value={dashboard.statistics.friends.total}
          subtitle={
            dashboard.statistics.friends.pendingRequests > 0
              ? `${dashboard.statistics.friends.pendingRequests} pending requests`
              : 'All caught up!'
          }
          icon="👥"
        />
        <StatCard
          title="Chats"
          value={dashboard.statistics.chats.total}
          subtitle="Active conversations"
          icon="💬"
        />
        <StatCard
          title="Messages"
          value={dashboard.statistics.messages.totalSent}
          subtitle="Messages sent"
          icon="✉️"
        />
      </div>

      {/* Recent Activities */}
      <div className="recent-activities">
        <h2>Recent Activity</h2>
        <ActivityFeed activities={dashboard.recentActivities} />
      </div>

      {/* Activity Breakdown Chart */}
      <div className="activity-breakdown">
        <h2>Activity Breakdown</h2>
        <ActivityChart data={dashboard.activityBreakdown} />
      </div>
    </div>
  );
};

export default Dashboard;
```

---

#### 2. Stat Card Component

```typescript
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon }) => {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{title}</h3>
        <div className="stat-value">{value.toLocaleString()}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );
};
```

**CSS:**
```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-icon {
  font-size: 48px;
}

.stat-content h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.stat-subtitle {
  font-size: 13px;
  color: #999;
}
```

---

#### 3. Activity Feed Component

```typescript
interface Activity {
  type: string;
  timestamp: string;
  data: any;
}

const ActivityFeed: React.FC<{ activities: Activity[] }> = ({ activities }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'file_upload': return '📁';
      case 'message_sent': return '💬';
      case 'chat_created': return '🆕';
      case 'friend_added': return '👥';
      default: return '📌';
    }
  };

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'file_upload':
        return `Uploaded ${activity.data.fileType}: ${activity.data.fileName}`;
      case 'message_sent':
        return `Sent message: "${activity.data.text}"`;
      case 'chat_created':
        return 'Started a new chat';
      case 'friend_added':
        return `Became friends with ${activity.data.friendUsername}`;
      default:
        return 'Activity';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (activities.length === 0) {
    return (
      <div className="empty-state">
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {activities.map((activity, index) => (
        <div key={index} className="activity-item">
          <div className="activity-icon">
            {getActivityIcon(activity.type)}
          </div>
          <div className="activity-content">
            <div className="activity-text">
              {getActivityText(activity)}
            </div>
            <div className="activity-time">
              {formatTimestamp(activity.timestamp)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

**CSS:**
```css
.activity-feed {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
}

.activity-content {
  flex: 1;
}

.activity-text {
  color: #333;
  margin-bottom: 4px;
}

.activity-time {
  font-size: 12px;
  color: #999;
}
```

---

#### 4. Activity Chart Component

```typescript
import { Doughnut } from 'react-chartjs-2';

interface ActivityBreakdown {
  type: string;
  count: number;
}

const ActivityChart: React.FC<{ data: ActivityBreakdown[] }> = ({ data }) => {
  const chartData = {
    labels: data.map(item => {
      switch (item.type) {
        case 'file_upload': return 'Files Uploaded';
        case 'chat_created': return 'Chats Created';
        case 'message_sent': return 'Messages Sent';
        case 'friends': return 'Friends';
        default: return item.type;
      }
    }),
    datasets: [{
      data: data.map(item => item.count),
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
      ],
      borderWidth: 0,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  return (
    <div className="chart-container">
      <Doughnut data={chartData} options={options} />
    </div>
  );
};
```

---

#### 5. Loading Skeleton

```typescript
const DashboardSkeleton = () => {
  return (
    <div className="dashboard skeleton">
      <div className="stats-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card skeleton-card">
            <div className="skeleton-icon"></div>
            <div className="skeleton-content">
              <div className="skeleton-line short"></div>
              <div className="skeleton-line medium"></div>
              <div className="skeleton-line long"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="skeleton-section">
        <div className="skeleton-title"></div>
        <div className="skeleton-feed">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-activity"></div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

**CSS:**
```css
.skeleton-card {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  background: #ddd;
  border-radius: 50%;
}

.skeleton-line {
  height: 12px;
  background: #ddd;
  border-radius: 4px;
  margin-bottom: 8px;
}

.skeleton-line.short { width: 40%; }
.skeleton-line.medium { width: 60%; }
.skeleton-line.long { width: 80%; }

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### Vanilla JavaScript Example

```javascript
async function loadDashboard() {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch('/memories/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      renderDashboard(result.data);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function renderDashboard(data) {
  // Render statistics
  document.getElementById('total-files').textContent = data.statistics.files.total;
  document.getElementById('total-images').textContent = data.statistics.files.images;
  document.getElementById('total-videos').textContent = data.statistics.files.videos;
  document.getElementById('total-friends').textContent = data.statistics.friends.total;
  document.getElementById('pending-requests').textContent = data.statistics.friends.pendingRequests;
  document.getElementById('total-chats').textContent = data.statistics.chats.total;
  document.getElementById('total-messages').textContent = data.statistics.messages.totalSent;

  // Render recent activities
  const activitiesContainer = document.getElementById('recent-activities');
  activitiesContainer.innerHTML = '';

  data.recentActivities.forEach(activity => {
    const activityElement = createActivityElement(activity);
    activitiesContainer.appendChild(activityElement);
  });

  // Render chart
  renderActivityChart(data.activityBreakdown);
}

function createActivityElement(activity) {
  const div = document.createElement('div');
  div.className = 'activity-item';

  let text = '';
  switch (activity.type) {
    case 'file_upload':
      text = `Uploaded ${activity.data.fileName}`;
      break;
    case 'message_sent':
      text = `Sent: "${activity.data.text}"`;
      break;
    case 'friend_added':
      text = `Became friends with ${activity.data.friendUsername}`;
      break;
  }

  div.innerHTML = `
    <span class="activity-text">${text}</span>
    <span class="activity-time">${formatTime(activity.timestamp)}</span>
  `;

  return div;
}
```

---

## Best Practices

### 1. Caching

Cache dashboard data for a short period to reduce API calls:

```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const useDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [lastFetch, setLastFetch] = useState(0);

  const fetchDashboard = async (force = false) => {
    const now = Date.now();

    if (!force && now - lastFetch < CACHE_DURATION && dashboard) {
      return; // Use cached data
    }

    const response = await fetch('/memories/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();
    setDashboard(result.data);
    setLastFetch(now);
  };

  return { dashboard, fetchDashboard };
};
```

---

### 2. Auto-refresh

Refresh dashboard when user returns to the page:

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      fetchDashboard();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

---

### 3. Real-time Updates

Update dashboard when user performs actions:

```typescript
const DashboardProvider = ({ children }) => {
  const [dashboard, setDashboard] = useState(null);

  const updateStats = (type: string) => {
    // Optimistically update the UI
    setDashboard(prev => {
      if (!prev) return prev;

      const updated = { ...prev };

      switch (type) {
        case 'file_upload':
          updated.statistics.files.total++;
          break;
        case 'friend_added':
          updated.statistics.friends.total++;
          break;
        case 'message_sent':
          updated.statistics.messages.totalSent++;
          break;
      }

      return updated;
    });

    // Optionally refetch to ensure accuracy
    setTimeout(() => fetchDashboard(), 1000);
  };

  return (
    <DashboardContext.Provider value={{ dashboard, updateStats }}>
      {children}
    </DashboardContext.Provider>
  );
};
```

---

### 4. Error Handling

```typescript
const fetchDashboard = async () => {
  try {
    const response = await fetch('/memories/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Redirect to login
      window.location.href = '/login';
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard');
    }

    const result = await response.json();
    setDashboard(result.data);
    setError(null);
  } catch (error) {
    console.error('Dashboard error:', error);
    setError('Failed to load dashboard. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

---

## Summary

The Dashboard API provides:
- ✅ **Single endpoint** for all statistics
- ✅ **Comprehensive data** in one request
- ✅ **Recent activities** across all types
- ✅ **Activity breakdown** for charts
- ✅ **Optimized** with parallel queries

Perfect for creating a user dashboard that shows everything at a glance!
