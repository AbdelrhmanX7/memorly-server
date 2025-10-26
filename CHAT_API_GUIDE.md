# Chat API - Frontend Integration Guide

This guide explains how to integrate the Chat and Messaging API into your frontend application.

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Usage Examples](#usage-examples)
5. [Common Patterns](#common-patterns)
6. [Real-time Integration](#real-time-integration)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Overview

The Chat API provides a complete messaging system with:
- Chat session management (create, list, get, delete)
- Message management (send, retrieve, delete)
- Support for both user and system messages
- Automatic timestamp tracking
- Memory tracking for timeline integration

**Base URL:** `/chat`

---

## Authentication

All Chat API endpoints require authentication. Include the JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### Chat Management

#### 1. Create Chat

**Endpoint:** `POST /chat/create`

Creates a new chat session for the authenticated user.

**Request:**
```javascript
// No body required
```

**Response:**
```json
{
  "success": true,
  "message": "Chat created successfully",
  "data": {
    "chat": {
      "id": "6721abc123def456789012",
      "userId": "6721abc123def456789013",
      "createdAt": "2025-10-26T14:30:00.000Z",
      "updatedAt": "2025-10-26T14:30:00.000Z"
    }
  }
}
```

---

#### 2. Get All User Chats

**Endpoint:** `GET /chat/list`

Retrieves all chat sessions for the authenticated user, sorted by most recently updated.

**Response:**
```json
{
  "success": true,
  "message": "Chats retrieved successfully",
  "data": {
    "chats": [
      {
        "id": "6721abc123def456789012",
        "userId": "6721abc123def456789013",
        "createdAt": "2025-10-25T10:00:00.000Z",
        "updatedAt": "2025-10-26T14:30:00.000Z"
      },
      {
        "id": "6721abc123def456789014",
        "userId": "6721abc123def456789013",
        "createdAt": "2025-10-24T09:00:00.000Z",
        "updatedAt": "2025-10-24T15:20:00.000Z"
      }
    ]
  }
}
```

---

#### 3. Get Chat by ID

**Endpoint:** `GET /chat/:chatId`

Retrieves a specific chat session by ID.

**URL Parameters:**
- `chatId` (required): The chat ID

**Response:**
```json
{
  "success": true,
  "message": "Chat retrieved successfully",
  "data": {
    "chat": {
      "id": "6721abc123def456789012",
      "userId": "6721abc123def456789013",
      "createdAt": "2025-10-25T10:00:00.000Z",
      "updatedAt": "2025-10-26T14:30:00.000Z"
    }
  }
}
```

---

#### 4. Delete Chat

**Endpoint:** `DELETE /chat/:chatId`

Deletes a specific chat session and all its messages.

**URL Parameters:**
- `chatId` (required): The chat ID

**Response:**
```json
{
  "success": true,
  "message": "Chat deleted successfully",
  "data": null
}
```

---

### Message Management

#### 5. Create Message

**Endpoint:** `POST /chat/message/create`

Creates a new message in a chat session.

**Request Body:**
```json
{
  "chatId": "6721abc123def456789012",
  "text": "Hello, I need help with my account",
  "senderType": "user"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chatId` | string | Yes | The ID of the chat session |
| `text` | string | Yes | Message content (max 5000 chars) |
| `senderType` | enum | Yes | Either `"user"` or `"system"` |

**Response:**
```json
{
  "success": true,
  "message": "Message created successfully",
  "data": {
    "message": {
      "id": "6721abc123def456789015",
      "userId": "6721abc123def456789013",
      "chatId": "6721abc123def456789012",
      "text": "Hello, I need help with my account",
      "senderType": "user",
      "createdAt": "2025-10-26T14:30:00.000Z",
      "updatedAt": "2025-10-26T14:30:00.000Z"
    }
  }
}
```

**Notes:**
- User messages are automatically tracked in the memories timeline
- System messages are not added to the timeline
- The chat's `updatedAt` timestamp is automatically updated
- **AI responses are automatically generated** for user messages and saved as system messages
- The AI uses the provided memory assistant prompt to answer based on user's stored memories

---

#### 6. Get Chat Messages

**Endpoint:** `GET /chat/:chatId/messages`

Retrieves all messages for a specific chat, sorted chronologically (oldest first).

**URL Parameters:**
- `chatId` (required): The chat ID

**Response:**
```json
{
  "success": true,
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [
      {
        "id": "6721abc123def456789015",
        "userId": "6721abc123def456789013",
        "chatId": "6721abc123def456789012",
        "text": "Hello, I need help with my account",
        "senderType": "user",
        "createdAt": "2025-10-26T14:30:00.000Z",
        "updatedAt": "2025-10-26T14:30:00.000Z"
      },
      {
        "id": "6721abc123def456789016",
        "userId": "6721abc123def456789013",
        "chatId": "6721abc123def456789012",
        "text": "I can help you with that. What specifically do you need?",
        "senderType": "system",
        "createdAt": "2025-10-26T14:30:15.000Z",
        "updatedAt": "2025-10-26T14:30:15.000Z"
      }
    ]
  }
}
```

---

#### 7. Delete Message

**Endpoint:** `DELETE /chat/message/:messageId`

Deletes a specific message from a chat.

**URL Parameters:**
- `messageId` (required): The message ID

**Response:**
```json
{
  "success": true,
  "message": "Message deleted successfully",
  "data": null
}
```

---

## Usage Examples

### React/TypeScript Implementation

#### 1. Chat List Component

```typescript
import { useState, useEffect } from 'react';

interface Chat {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const ChatList = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  const fetchChats = async () => {
    try {
      const response = await fetch('/chat/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setChats(data.data.chats);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await fetch('/chat/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Add new chat to list
        setChats(prev => [data.data.chat, ...prev]);
        // Navigate to the new chat
        window.location.href = `/chat/${data.data.chat.id}`;
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      const response = await fetch(`/chat/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();

      if (data.success) {
        // Remove from list
        setChats(prev => prev.filter(chat => chat.id !== chatId));
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  if (loading) return <div>Loading chats...</div>;

  return (
    <div className="chat-list">
      <div className="header">
        <h1>Your Chats</h1>
        <button onClick={createNewChat}>New Chat</button>
      </div>

      {chats.length === 0 ? (
        <div className="empty-state">
          <p>No chats yet. Start a new conversation!</p>
          <button onClick={createNewChat}>Create Chat</button>
        </div>
      ) : (
        <div className="chats">
          {chats.map(chat => (
            <div key={chat.id} className="chat-item">
              <a href={`/chat/${chat.id}`}>
                <div className="chat-info">
                  <h3>Chat #{chat.id.slice(-6)}</h3>
                  <p className="date">
                    Last updated: {new Date(chat.updatedAt).toLocaleString()}
                  </p>
                </div>
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  deleteChat(chat.id);
                }}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatList;
```

---

#### 2. Chat Interface Component

```typescript
import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  userId: string;
  chatId: string;
  text: string;
  senderType: 'user' | 'system';
  createdAt: string;
  updatedAt: string;
}

interface ChatInterfaceProps {
  chatId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/chat/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessages(data.data.messages);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim()) return;

    setSending(true);

    try {
      const response = await fetch('/chat/message/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId,
          text: inputText.trim(),
          senderType: 'user'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add message to list
        setMessages(prev => [...prev, data.data.message]);
        setInputText('');
        scrollToBottom();

        // Optionally, trigger AI response or system message
        // await generateSystemResponse(data.data.message.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/chat/message/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) return <div>Loading chat...</div>;

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.senderType === 'user' ? 'user-message' : 'system-message'}`}
            >
              <div className="message-content">
                <p>{message.text}</p>
                <span className="timestamp">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </span>
              </div>
              {message.senderType === 'user' && (
                <button
                  onClick={() => deleteMessage(message.id)}
                  className="delete-message-btn"
                  title="Delete message"
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="message-input-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message..."
          disabled={sending}
          maxLength={5000}
        />
        <button type="submit" disabled={sending || !inputText.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
```

---

#### 3. Complete Chat Page

```typescript
import { useParams } from 'react-router-dom';

const ChatPage = () => {
  const { chatId } = useParams<{ chatId: string }>();

  if (!chatId) {
    return <div>Invalid chat ID</div>;
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button onClick={() => window.history.back()}>← Back to Chats</button>
        <h1>Chat</h1>
      </div>
      <ChatInterface chatId={chatId} />
    </div>
  );
};

export default ChatPage;
```

---

### Vanilla JavaScript Example

```javascript
// Fetch and display chats
async function loadChats() {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch('/chat/list', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      displayChats(data.data.chats);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayChats(chats) {
  const container = document.getElementById('chats-container');
  container.innerHTML = '';

  if (chats.length === 0) {
    container.innerHTML = '<p>No chats yet. Create one to get started!</p>';
    return;
  }

  chats.forEach(chat => {
    const chatElement = document.createElement('div');
    chatElement.className = 'chat-item';
    chatElement.innerHTML = `
      <div onclick="openChat('${chat.id}')">
        <h3>Chat #${chat.id.slice(-6)}</h3>
        <p>${new Date(chat.updatedAt).toLocaleString()}</p>
      </div>
      <button onclick="deleteChat('${chat.id}')">Delete</button>
    `;
    container.appendChild(chatElement);
  });
}

// Create new chat
async function createChat() {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch('/chat/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      window.location.href = `/chat.html?id=${data.data.chat.id}`;
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Send message
async function sendMessage(chatId, text) {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch('/chat/message/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: chatId,
        text: text,
        senderType: 'user'
      })
    });

    const data = await response.json();

    if (data.success) {
      appendMessage(data.data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Load messages
async function loadMessages(chatId) {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/chat/${chatId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      displayMessages(data.data.messages);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayMessages(messages) {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  messages.forEach(message => {
    appendMessage(message);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function appendMessage(message) {
  const container = document.getElementById('messages-container');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.senderType === 'user' ? 'user' : 'system'}`;
  messageElement.innerHTML = `
    <p>${message.text}</p>
    <span class="time">${new Date(message.createdAt).toLocaleTimeString()}</span>
  `;
  container.appendChild(messageElement);
}
```

---

## Common Patterns

### 1. AI Integration / System Responses

```typescript
const generateSystemResponse = async (userMessageId: string, chatId: string) => {
  try {
    // Call your AI service or backend endpoint
    const aiResponse = await fetch('/ai/generate-response', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageId: userMessageId,
        chatId: chatId
      })
    });

    const aiData = await aiResponse.json();

    if (aiData.success) {
      // Create system message with AI response
      const response = await fetch('/chat/message/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: chatId,
          text: aiData.response,
          senderType: 'system'
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, data.data.message]);
      }
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
  }
};
```

---

### 2. Typing Indicator

```typescript
const TypingIndicator = () => {
  return (
    <div className="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
};

const ChatWithTyping = () => {
  const [isTyping, setIsTyping] = useState(false);

  const sendMessageWithTyping = async (text: string) => {
    // Send user message
    await sendMessage(text);

    // Show typing indicator
    setIsTyping(true);

    // Generate AI response
    await generateSystemResponse();

    // Hide typing indicator
    setIsTyping(false);
  };

  return (
    <div className="messages">
      {messages.map(msg => <Message key={msg.id} message={msg} />)}
      {isTyping && <TypingIndicator />}
    </div>
  );
};
```

---

### 3. Message Search

```typescript
const SearchableChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMessages = messages.filter(msg =>
    msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search messages..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="messages">
        {filteredMessages.map(msg => (
          <Message key={msg.id} message={msg} highlight={searchQuery} />
        ))}
      </div>
    </div>
  );
};
```

---

### 4. Chat with Last Message Preview

```typescript
interface ChatWithPreview extends Chat {
  lastMessage?: Message;
}

const ChatListWithPreviews = () => {
  const [chats, setChats] = useState<ChatWithPreview[]>([]);

  const fetchChatsWithPreviews = async () => {
    // First, fetch all chats
    const chatsResponse = await fetch('/chat/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chatsData = await chatsResponse.json();

    if (chatsData.success) {
      // Then fetch last message for each chat
      const chatsWithPreviews = await Promise.all(
        chatsData.data.chats.map(async (chat: Chat) => {
          const messagesResponse = await fetch(`/chat/${chat.id}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const messagesData = await messagesResponse.json();

          return {
            ...chat,
            lastMessage: messagesData.success
              ? messagesData.data.messages[messagesData.data.messages.length - 1]
              : undefined
          };
        })
      );

      setChats(chatsWithPreviews);
    }
  };

  return (
    <div className="chat-list">
      {chats.map(chat => (
        <div key={chat.id} className="chat-preview">
          <h3>Chat #{chat.id.slice(-6)}</h3>
          {chat.lastMessage && (
            <p className="last-message">
              {chat.lastMessage.senderType === 'user' ? 'You: ' : 'System: '}
              {chat.lastMessage.text.substring(0, 50)}...
            </p>
          )}
          <span className="time">
            {new Date(chat.updatedAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};
```

---

### 5. Export Chat History

```typescript
const exportChatHistory = async (chatId: string) => {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/chat/${chatId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      const messages = data.data.messages;

      // Convert to text format
      const textContent = messages
        .map(msg => {
          const time = new Date(msg.createdAt).toLocaleString();
          const sender = msg.senderType === 'user' ? 'You' : 'System';
          return `[${time}] ${sender}: ${msg.text}`;
        })
        .join('\n\n');

      // Create and download file
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${chatId}-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting chat:', error);
  }
};

// Export as JSON
const exportChatAsJSON = async (chatId: string) => {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/chat/${chatId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      const blob = new Blob([JSON.stringify(data.data.messages, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${chatId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting chat:', error);
  }
};
```

---

## Real-time Integration

### Using WebSockets for Real-time Updates

```typescript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const RealTimeChatInterface: React.FC<{ chatId: string }> = ({ chatId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('YOUR_WEBSOCKET_URL', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    setSocket(newSocket);

    // Join chat room
    newSocket.emit('join-chat', { chatId });

    // Listen for new messages
    newSocket.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for deleted messages
    newSocket.on('message-deleted', (messageId: string) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    });

    // Cleanup on unmount
    return () => {
      newSocket.emit('leave-chat', { chatId });
      newSocket.close();
    };
  }, [chatId]);

  const sendMessage = (text: string) => {
    if (socket) {
      socket.emit('send-message', {
        chatId,
        text,
        senderType: 'user'
      });
    }
  };

  return (
    // ... chat interface
  );
};
```

---

### Polling for Updates (Simple Alternative)

```typescript
const ChatWithPolling = ({ chatId }: { chatId: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());

  useEffect(() => {
    // Poll every 3 seconds
    const interval = setInterval(async () => {
      const response = await fetch(`/chat/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        const newMessages = data.data.messages.filter(
          (msg: Message) => new Date(msg.createdAt) > lastFetch
        );

        if (newMessages.length > 0) {
          setMessages(prev => [...prev, ...newMessages]);
          setLastFetch(new Date());
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [chatId, lastFetch]);

  return (/* chat interface */);
};
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
interface ApiError {
  message: string;
  statusCode?: number;
}

class ChatService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (response.status === 404) {
      throw new Error('Chat or message not found');
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'An error occurred');
    }

    return response.json();
  }

  async createChat(): Promise<Chat> {
    try {
      const response = await fetch('/chat/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await this.handleResponse(response);
      return data.data.chat;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  async sendMessage(chatId: string, text: string): Promise<Message> {
    if (!text.trim()) {
      throw new Error('Message cannot be empty');
    }

    if (text.length > 5000) {
      throw new Error('Message is too long (max 5000 characters)');
    }

    try {
      const response = await fetch('/chat/message/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId,
          text: text.trim(),
          senderType: 'user'
        })
      });

      const data = await this.handleResponse(response);
      return data.data.message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getMessages(chatId: string): Promise<Message[]> {
    try {
      const response = await fetch(`/chat/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await this.handleResponse(response);
      return data.data.messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }
}

// Usage with error handling
const ChatComponent = () => {
  const [error, setError] = useState<string | null>(null);
  const chatService = new ChatService(localStorage.getItem('token') || '');

  const handleSendMessage = async (text: string) => {
    setError(null);
    try {
      await chatService.sendMessage(chatId, text);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      {/* Rest of component */}
    </div>
  );
};
```

---

## Best Practices

### 1. Message Character Limit

Always validate message length before sending:

```typescript
const MessageInput = () => {
  const [text, setText] = useState('');
  const MAX_LENGTH = 5000;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_LENGTH) {
      setText(e.target.value);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type your message..."
        maxLength={MAX_LENGTH}
      />
      <span className="character-count">
        {text.length} / {MAX_LENGTH}
      </span>
    </div>
  );
};
```

---

### 2. Auto-save Draft Messages

```typescript
const useDraftMessage = (chatId: string) => {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    // Load draft from localStorage
    const saved = localStorage.getItem(`draft-${chatId}`);
    if (saved) {
      setDraft(saved);
    }
  }, [chatId]);

  useEffect(() => {
    // Auto-save draft
    if (draft) {
      localStorage.setItem(`draft-${chatId}`, draft);
    } else {
      localStorage.removeItem(`draft-${chatId}`);
    }
  }, [draft, chatId]);

  const clearDraft = () => {
    setDraft('');
    localStorage.removeItem(`draft-${chatId}`);
  };

  return { draft, setDraft, clearDraft };
};
```

---

### 3. Optimistic UI Updates

```typescript
const sendMessageOptimistic = async (text: string, chatId: string) => {
  // Create temporary message
  const tempMessage: Message = {
    id: `temp-${Date.now()}`,
    userId: currentUserId,
    chatId,
    text,
    senderType: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to UI immediately
  setMessages(prev => [...prev, tempMessage]);

  try {
    // Send to server
    const response = await fetch('/chat/message/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId,
        text,
        senderType: 'user'
      })
    });

    const data = await response.json();

    if (data.success) {
      // Replace temp message with real one
      setMessages(prev =>
        prev.map(msg => msg.id === tempMessage.id ? data.data.message : msg)
      );
    } else {
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      showError('Failed to send message');
    }
  } catch (error) {
    // Remove temp message on error
    setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    showError('Network error');
  }
};
```

---

### 4. Lazy Loading Messages

For chats with many messages, implement pagination:

```typescript
const LazyLoadMessages = ({ chatId }: { chatId: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const MESSAGES_PER_PAGE = 50;

  const loadMoreMessages = async () => {
    // Note: You'd need to add pagination to the backend endpoint
    const response = await fetch(
      `/chat/${chatId}/messages?page=${page}&limit=${MESSAGES_PER_PAGE}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const data = await response.json();

    if (data.success) {
      setMessages(prev => [...data.data.messages, ...prev]);
      setHasMore(data.data.messages.length === MESSAGES_PER_PAGE);
      setPage(prev => prev + 1);
    }
  };

  return (
    <div>
      {hasMore && <button onClick={loadMoreMessages}>Load More</button>}
      {messages.map(msg => <Message key={msg.id} message={msg} />)}
    </div>
  );
};
```

---

### 5. Context/State Management

Using React Context for chat state:

```typescript
import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  chats: Chat[];
  currentChatId: string | null;
  setCurrentChatId: (id: string) => void;
  addChat: (chat: Chat) => void;
  removeChat: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const addChat = (chat: Chat) => {
    setChats(prev => [chat, ...prev]);
  };

  const removeChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  };

  return (
    <ChatContext.Provider value={{
      chats,
      currentChatId,
      setCurrentChatId,
      addChat,
      removeChat
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
```

---

## CSS Examples

### Message Styling

```css
.messages-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  max-height: 600px;
  overflow-y: auto;
  background: #f5f5f5;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 70%;
}

.user-message {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.user-message .message-content {
  background: #007bff;
  color: white;
  border-radius: 18px 18px 4px 18px;
}

.system-message .message-content {
  background: white;
  color: #333;
  border-radius: 18px 18px 18px 4px;
  border: 1px solid #e0e0e0;
}

.message-content {
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-content p {
  margin: 0 0 4px 0;
  word-wrap: break-word;
}

.timestamp {
  font-size: 11px;
  opacity: 0.7;
}

.message-input-form {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.message-input-form input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 24px;
  outline: none;
}

.message-input-form button {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #999;
  border-radius: 50%;
  animation: bounce 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-10px); }
}
```

---

## Testing

### Mock Data for Testing

```typescript
export const mockChats: Chat[] = [
  {
    id: '6721abc123def456789012',
    userId: '6721abc123def456789013',
    createdAt: '2025-10-25T10:00:00.000Z',
    updatedAt: '2025-10-26T14:30:00.000Z'
  }
];

export const mockMessages: Message[] = [
  {
    id: '1',
    userId: '123',
    chatId: '6721abc123def456789012',
    text: 'Hello, I need help',
    senderType: 'user',
    createdAt: '2025-10-26T14:30:00.000Z',
    updatedAt: '2025-10-26T14:30:00.000Z'
  },
  {
    id: '2',
    userId: '123',
    chatId: '6721abc123def456789012',
    text: 'Sure, how can I help you?',
    senderType: 'system',
    createdAt: '2025-10-26T14:30:05.000Z',
    updatedAt: '2025-10-26T14:30:05.000Z'
  }
];
```

---

## Summary

The Chat API provides a complete messaging system with:
- ✅ Simple chat session management
- ✅ User and system message support
- ✅ Automatic timestamp tracking
- ✅ Memory timeline integration
- ✅ RESTful API design
- ✅ Authentication required for all endpoints

For questions or issues, refer to the main API documentation.
