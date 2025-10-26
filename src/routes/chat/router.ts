import express from "express";
import {
  createChat,
  getUserChats,
  getChatById,
  deleteChat,
} from "../../controllers/chat.controller";
import {
  createMessage,
  getChatMessages,
  deleteMessage,
  generateStreamingResponse,
} from "../../controllers/message.controller";
import { verifyToken } from "../../middleware/auth.middleware";

const router = express.Router();

// All chat routes require authentication
router.use(verifyToken);

// Chat routes
/**
 * @swagger
 * /chat/create:
 *   post:
 *     tags: [Chat]
 *     summary: Create a new chat
 *     description: Create a new chat session for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Chat created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Chat created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     chat:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         userId:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/create", createChat);

/**
 * @swagger
 * /chat/list:
 *   get:
 *     tags: [Chat]
 *     summary: Get all user chats
 *     description: Retrieve all chat sessions for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Chats retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     chats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/list", getUserChats);

/**
 * @swagger
 * /chat/{chatId}:
 *   get:
 *     tags: [Chat]
 *     summary: Get chat by ID
 *     description: Retrieve a specific chat session by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.get("/:chatId", getChatById);

/**
 * @swagger
 * /chat/{chatId}:
 *   delete:
 *     tags: [Chat]
 *     summary: Delete chat
 *     description: Delete a specific chat session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:chatId", deleteChat);

// Message routes
/**
 * @swagger
 * /chat/message/create:
 *   post:
 *     tags: [Message]
 *     summary: Create a new message
 *     description: Create a new message in a chat session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *               - text
 *               - senderType
 *             properties:
 *               chatId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               text:
 *                 type: string
 *                 example: Hello, I need help with my account
 *               senderType:
 *                 type: string
 *                 enum: [user, system]
 *                 example: user
 *     responses:
 *       201:
 *         description: Message created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Message created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         userId:
 *                           type: string
 *                         chatId:
 *                           type: string
 *                         text:
 *                           type: string
 *                         senderType:
 *                           type: string
 *                           enum: [user, system]
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Bad request - missing required fields or invalid senderType
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.post("/message/create", createMessage);

/**
 * @swagger
 * /chat/generate:
 *   post:
 *     tags: [Message]
 *     summary: Generate AI response with streaming (SSE)
 *     description: |
 *       Generate conversational AI response using LLM based on retrieved memories.
 *       This endpoint streams the response in Server-Sent Events (SSE) format.
 *       Pipeline:
 *       1. Save user message to database
 *       2. Retrieve relevant memories (via LLM service)
 *       3. Generate conversational response (via LLM service)
 *       4. Stream response to client
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *               - text
 *             properties:
 *               chatId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               text:
 *                 type: string
 *                 example: What did I do last week?
 *               limit:
 *                 type: number
 *                 example: 10
 *                 default: 10
 *                 description: Number of memories to retrieve
 *     responses:
 *       200:
 *         description: Streaming response (SSE format)
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 data: {"type": "metadata", "data": {"sources": [...]}}
 *
 *                 data: {"type": "chunk", "data": "Based on your memories"}
 *
 *                 data: {"type": "chunk", "data": ", you visited..."}
 *
 *                 data: {"type": "done", "data": {"processing_time": 2.5}}
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.post("/generate", generateStreamingResponse);

/**
 * @swagger
 * /chat/{chatId}/messages:
 *   get:
 *     tags: [Message]
 *     summary: Get all messages in a chat
 *     description: Retrieve all messages for a specific chat session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Messages retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           chatId:
 *                             type: string
 *                           text:
 *                             type: string
 *                           senderType:
 *                             type: string
 *                             enum: [user, system]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
router.get("/:chatId/messages", getChatMessages);

/**
 * @swagger
 * /chat/message/{messageId}:
 *   delete:
 *     tags: [Message]
 *     summary: Delete a message
 *     description: Delete a specific message from a chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal server error
 */
router.delete("/message/:messageId", deleteMessage);

export default router;
