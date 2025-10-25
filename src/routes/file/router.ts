import express from "express";
import {
  uploadFile,
  getUserFiles,
  getFileById,
  deleteFile,
} from "../../controllers/file.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";

const router = express.Router();

// All file routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /files/upload:
 *   post:
 *     tags: [Files]
 *     summary: Upload a file (image or video)
 *     description: Upload an image or video file to Backblaze B2 storage. Maximum 10MB for images, 100MB for videos.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload (image or video)
 *     responses:
 *       201:
 *         description: File uploaded successfully
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
 *                   example: File uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     fileType:
 *                       type: string
 *                       enum: [image, video]
 *                     fileSize:
 *                       type: number
 *                     fileUrl:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or file size exceeded
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/upload", upload.single("file"), uploadFile);

/**
 * @swagger
 * /files:
 *   get:
 *     tags: [Files]
 *     summary: Get user's files
 *     description: Retrieve a paginated list of files uploaded by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: Filter by file type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", getUserFiles);

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     tags: [Files]
 *     summary: Get file by ID
 *     description: Retrieve a specific file by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get("/:id", getFileById);

/**
 * @swagger
 * /files/{id}:
 *   delete:
 *     tags: [Files]
 *     summary: Delete a file
 *     description: Delete a file from both Backblaze B2 and the database
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", deleteFile);

export default router;
