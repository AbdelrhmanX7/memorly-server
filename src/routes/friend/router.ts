import express from "express";
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getPendingRequests,
  getFriendsList,
  removeFriend,
  getBlockedUsers,
  unblockUser,
} from "../../controllers/friend.controller";
import { verifyToken } from "../../middleware/auth.middleware";

const router = express.Router();

// All friend routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /friends/search:
 *   get:
 *     tags: [Friends]
 *     summary: Search for users by username
 *     description: Search for users by their username to send friend requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username to search for (partial match, case-insensitive)
 *         example: john
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                   example: Users retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                           isVerified:
 *                             type: boolean
 *       400:
 *         description: Missing username parameter
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/search", searchUsers);

/**
 * @swagger
 * /friends/request:
 *   post:
 *     tags: [Friends]
 *     summary: Send a friend request
 *     description: Send a friend request to another user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *             properties:
 *               receiverId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       201:
 *         description: Friend request sent successfully
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
 *                   example: Friend request sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     friendRequest:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         senderId:
 *                           type: string
 *                         receiverId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, accepted, rejected]
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Bad request - missing receiverId, trying to add yourself, or request already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot send request - user has blocked you
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/request", sendFriendRequest);

/**
 * @swagger
 * /friends/request/{requestId}/accept:
 *   post:
 *     tags: [Friends]
 *     summary: Accept a friend request
 *     description: Accept a pending friend request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Friend request ID
 *     responses:
 *       200:
 *         description: Friend request accepted
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
 *                   example: Friend request accepted
 *                 data:
 *                   type: object
 *                   properties:
 *                     friendRequest:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         senderId:
 *                           type: string
 *                         receiverId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: accepted
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Friend request not found
 *       500:
 *         description: Internal server error
 */
router.post("/request/:requestId/accept", acceptFriendRequest);

/**
 * @swagger
 * /friends/request/{requestId}/reject:
 *   post:
 *     tags: [Friends]
 *     summary: Reject a friend request
 *     description: Reject a pending friend request and block the sender from sending future requests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Friend request ID
 *     responses:
 *       200:
 *         description: Friend request rejected
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
 *                   example: Friend request rejected
 *                 data:
 *                   type: object
 *                   properties:
 *                     friendRequest:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         senderId:
 *                           type: string
 *                         receiverId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: rejected
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Friend request not found
 *       500:
 *         description: Internal server error
 */
router.post("/request/:requestId/reject", rejectFriendRequest);

/**
 * @swagger
 * /friends/requests/pending:
 *   get:
 *     tags: [Friends]
 *     summary: Get pending friend requests
 *     description: Get all pending friend requests received by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending friend requests retrieved successfully
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
 *                   example: Pending friend requests retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           sender:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               isVerified:
 *                                 type: boolean
 *                           status:
 *                             type: string
 *                             example: pending
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/requests/pending", getPendingRequests);

/**
 * @swagger
 * /friends/list:
 *   get:
 *     tags: [Friends]
 *     summary: Get friends list
 *     description: Get all accepted friends for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Friends list retrieved successfully
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
 *                   example: Friends list retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     friends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           friend:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               isVerified:
 *                                 type: boolean
 *                           friendsSince:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/list", getFriendsList);

/**
 * @swagger
 * /friends/{friendId}:
 *   delete:
 *     tags: [Friends]
 *     summary: Remove a friend
 *     description: Remove an accepted friend from your friends list
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *         description: Friend user ID
 *     responses:
 *       200:
 *         description: Friend removed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Friendship not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:friendId", removeFriend);

/**
 * @swagger
 * /friends/blocked:
 *   get:
 *     tags: [Friends]
 *     summary: Get blocked users list
 *     description: Get all users blocked by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked users retrieved successfully
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
 *                   example: Blocked users retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     blockedUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           blockedUser:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                           blockedAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/blocked", getBlockedUsers);

/**
 * @swagger
 * /friends/unblock/{blockedUserId}:
 *   delete:
 *     tags: [Friends]
 *     summary: Unblock a user
 *     description: Remove a user from the blocked list, allowing them to send friend requests again
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blockedUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Blocked user ID
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Blocked user not found
 *       500:
 *         description: Internal server error
 */
router.delete("/unblock/:blockedUserId", unblockUser);

export default router;
