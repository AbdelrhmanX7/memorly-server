# AI Chat Integration - Memory Assistant

## Overview

The chat system automatically generates AI-powered responses to user messages using Google's Gemini AI. The AI acts as an intelligent personal memory assistant that helps users recall details, summarize moments, and answer questions from their stored memories.

---

## How It Works

### Automatic AI Responses

When a user sends a message:

1. ✅ User message is saved to database
2. ✅ Response is sent to user immediately
3. ✅ **AI response generation begins in the background**
4. ✅ AI retrieves relevant memories (files, previous messages)
5. ✅ AI generates response based on memory context
6. ✅ AI response is saved as a system message
7. ✅ User sees AI response when they fetch messages

### Flow Diagram

```
User sends message
    ↓
Save to database
    ↓
Return success to user ✅
    ↓
[BACKGROUND PROCESS]
    ├─ Retrieve relevant memories
    ├─ Build AI prompt with context
    ├─ Generate AI response
    └─ Save as system message
```

---

## AI Prompt Template

The AI uses a specialized prompt that includes:

### User Query
The message the user sent

### Retrieved Context
Relevant memories from the user's history:
- **Recent files** uploaded (images/videos)
- **Recent messages** from conversations
- Each memory includes metadata like:
  - Modality (video, audio, text, etc.)
  - Timestamp
  - Content/description
  - File URLs

### Instructions
The AI is instructed to:
1. Read all retrieved memories carefully
2. Synthesize a concise, factual answer
3. Reference people, places, or timestamps when possible
4. Merge related memories coherently
5. Infer actions/events from video/audio descriptions
6. **Never invent details** not supported by data
7. Clearly state when information is insufficient

---

## Memory Retrieval

Currently retrieves:
- **Last 5 files** uploaded by user
- **Last 10 user messages** from chats

### Example Memory Format

```json
[
  {
    "id": "6721abc...",
    "modality": "video",
    "content": "File: vacation_2024.mp4",
    "timestamp": "2025-10-26T14:30:00.000Z",
    "source_path": "https://storage.../vacation_2024.mp4",
    "tags": ["video"],
    "$meta": {
      "fileSize": 15728640,
      "mimeType": "video/mp4"
    }
  },
  {
    "id": "6721def...",
    "modality": "text",
    "content": "Had a great time at the beach yesterday!",
    "timestamp": "2025-10-25T18:20:00.000Z",
    "tags": ["message", "chat"]
  }
]
```

---

## Configuration

### AI Model
- **Model:** `gemini-2.0-flash-exp`
- **Temperature:** 0.7 (balanced creativity/accuracy)
- **Top P:** 0.8
- **Top K:** 40
- **Max Tokens:** 1024

### Environment Variables

Required in `.env`:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Frontend Integration

### 1. Sending Messages

Send messages as usual - AI responses are automatic:

```typescript
const sendMessage = async (chatId: string, text: string) => {
  const response = await fetch('/chat/message/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chatId,
      text,
      senderType: 'user'  // Always 'user' for manual messages
    })
  });

  const data = await response.json();

  // User message saved immediately
  // AI response will appear shortly in messages list

  return data;
};
```

### 2. Polling for AI Response

**Option A: Polling** (Simple)

```typescript
const ChatInterface = ({ chatId }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Poll every 2 seconds for new messages
    const interval = setInterval(async () => {
      const response = await fetch(`/chat/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setMessages(data.data.messages);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [chatId]);

  return (
    <div>
      {messages.map(msg => (
        <Message
          key={msg.id}
          message={msg}
          isAI={msg.senderType === 'system'}
        />
      ))}
    </div>
  );
};
```

**Option B: WebSockets** (Real-time)

```typescript
import io from 'socket.io-client';

const ChatInterface = ({ chatId }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = io('YOUR_SERVER_URL');

    socket.on(`chat:${chatId}:new-message`, (newMessage) => {
      setMessages(prev => [...prev, newMessage]);
    });

    return () => socket.disconnect();
  }, [chatId]);
};
```

### 3. Showing Typing Indicator

Show when AI is thinking:

```typescript
const ChatInterface = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [aiTyping, setAiTyping] = useState(false);

  const sendMessage = async (text: string) => {
    // Send message
    await createMessage(chatId, text);

    // Show AI typing indicator
    setAiTyping(true);

    // Poll for AI response
    const checkForAIResponse = setInterval(async () => {
      const response = await fetch(`/chat/${chatId}/messages`);
      const data = await response.json();

      const lastMessage = data.data.messages[data.data.messages.length - 1];

      if (lastMessage && lastMessage.senderType === 'system') {
        setMessages(data.data.messages);
        setAiTyping(false);
        clearInterval(checkForAIResponse);
      }
    }, 1000);

    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(checkForAIResponse);
      setAiTyping(false);
    }, 30000);
  };

  return (
    <div>
      {messages.map(msg => <Message key={msg.id} message={msg} />)}
      {aiTyping && <TypingIndicator text="AI is thinking..." />}
    </div>
  );
};
```

---

## Example Conversations

### Example 1: Asking about uploaded files

**User:** "What videos did I upload recently?"

**AI Response:**
```
Based on your recent uploads, I can see you uploaded:
1. vacation_2024.mp4 on October 26, 2025 at 2:30 PM
2. family_dinner.mp4 on October 25, 2025

These appear to be video files from your recent activities.
```

### Example 2: Asking about past conversations

**User:** "What did I say about the beach?"

**AI Response:**
```
In your recent messages, you mentioned "Had a great time at the beach yesterday!"
on October 25, 2025 at 6:20 PM. It seems you enjoyed your beach visit!
```

### Example 3: Insufficient information

**User:** "When did I meet John?"

**AI Response:**
```
I don't have enough information in your stored memories to answer when you met John.
The available data doesn't include details about meeting John specifically.
```

---

## Customization

### Modify Memory Retrieval

Edit `/src/services/ai-chat.service.ts`:

```typescript
const retrieveRelevantMemories = async (
  userId: string,
  userQuery: string
): Promise<any[]> => {
  // TODO: Integrate with your vector database
  // Current implementation fetches recent items

  // Example: Add semantic search
  const vectorResults = await vectorDB.search(userQuery, {
    user: userId,
    limit: 10
  });

  return vectorResults;
};
```

### Modify AI Prompt

Edit the `buildMemoryPrompt` function:

```typescript
const buildMemoryPrompt = (userQuery: string, retrievedData: any[]): string => {
  return `Your custom prompt here...`;
};
```

### Adjust AI Parameters

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash-exp",
  contents: [...],
  config: {
    temperature: 0.9,  // More creative
    topP: 0.95,
    topK: 50,
    maxOutputTokens: 2048  // Longer responses
  }
});
```

---

## Error Handling

### If AI Fails

The system gracefully handles AI failures:

```typescript
// If AI generation fails, no system message is created
// User message is still saved and visible
// Error is logged but doesn't affect user experience
```

### Monitoring

Check server logs for AI errors:

```bash
tail -f server.log | grep "AI response generation error"
```

---

## Performance

### Response Time
- **User message save:** ~50ms (instant)
- **AI response generation:** 2-5 seconds (background)
- **Total user wait:** 0ms (non-blocking)

### Cost Optimization
- AI only runs for user messages
- System messages don't trigger AI
- Failed generations are logged and retried

---

## Future Enhancements

### Vector Database Integration

Replace simple memory retrieval with semantic search:

```typescript
// Install: npm install @pinecone-database/pinecone
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const retrieveRelevantMemories = async (userId: string, query: string) => {
  const embedding = await generateEmbedding(query);

  const results = await pinecone.query({
    vector: embedding,
    filter: { userId },
    topK: 10
  });

  return results.matches.map(match => match.metadata);
};
```

### Advanced Memory Types

Add support for:
- Image descriptions (OCR/vision AI)
- Audio transcriptions
- Location data
- People recognition
- Object detection in videos

### Conversation Context

Maintain conversation history:

```typescript
const getChatHistory = async (chatId: string) => {
  // Get last 10 messages for context
  return Message.find({ chatId })
    .sort({ createdAt: -1 })
    .limit(10);
};
```

---

## Troubleshooting

### AI Not Responding

**Check:**
1. ✅ GEMINI_API_KEY is set in `.env`
2. ✅ Gemini is initialized on server start
3. ✅ Check server logs for errors
4. ✅ Verify user is sending senderType: "user"

### Slow Responses

**Solutions:**
- Reduce `maxOutputTokens`
- Use faster model: `gemini-1.5-flash`
- Reduce number of memories retrieved
- Implement caching for common queries

### Inaccurate Responses

**Improve by:**
- Adding more context to memories
- Implementing vector database for better retrieval
- Tuning AI parameters (temperature, etc.)
- Refining the prompt template

---

## Security

### API Key Protection
- ✅ GEMINI_API_KEY stored in environment variables
- ✅ Never exposed to frontend
- ✅ All AI calls server-side only

### User Data
- ✅ Each user only sees their own memories
- ✅ AI responses are user-specific
- ✅ No cross-user data leakage

---

## Summary

The AI chat integration provides:
- ✅ **Automatic** AI responses to user messages
- ✅ **Context-aware** answers based on stored memories
- ✅ **Non-blocking** background processing
- ✅ **Customizable** prompt and parameters
- ✅ **Scalable** architecture for future enhancements

Perfect for creating an intelligent memory assistant! 🤖
