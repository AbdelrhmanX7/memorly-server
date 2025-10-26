import express from "express";
import {
  initiateUpload,
  uploadChunkHandler,
  completeUpload,
  abortUpload,
  getUploadStatusHandler,
} from "../../controllers/chunk-upload.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { chunkUpload } from "../../middleware/upload.middleware";

const router = express.Router();

// All chunk upload routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /files/chunk/initiate:
 *   post:
 *     tags: [Chunked Upload]
 *     summary: Initiate a chunked upload session
 *     description: Start a multipart upload session for large video files (>100MB, up to 10GB)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalName
 *               - mimeType
 *               - totalSize
 *               - totalChunks
 *             properties:
 *               originalName:
 *                 type: string
 *                 description: Original filename
 *                 example: my-video.mp4
 *               mimeType:
 *                 type: string
 *                 description: Video MIME type
 *                 example: video/mp4
 *               totalSize:
 *                 type: number
 *                 description: Total file size in bytes
 *                 example: 524288000
 *               totalChunks:
 *                 type: number
 *                 description: Total number of chunks
 *                 example: 100
 *     responses:
 *       201:
 *         description: Upload session initiated successfully
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
 *                   example: Chunked upload initiated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploadId:
 *                       type: string
 *                       description: Unique upload session ID
 *                     fileName:
 *                       type: string
 *                       description: Generated filename in storage
 *                     chunkSize:
 *                       type: number
 *                       description: Recommended chunk size (5MB)
 *                       example: 5242880
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/initiate", initiateUpload);

/**
 * @swagger
 * /files/chunk/upload:
 *   post:
 *     tags: [Chunked Upload]
 *     summary: Upload a single chunk
 *     description: Upload a chunk of the file (must be called for each chunk in sequence)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *               - partNumber
 *               - chunk
 *             properties:
 *               uploadId:
 *                 type: string
 *                 description: Upload session ID from initiate endpoint
 *               partNumber:
 *                 type: integer
 *                 description: Chunk number (1-based index)
 *                 example: 1
 *               chunk:
 *                 type: string
 *                 format: binary
 *                 description: Chunk data (5MB recommended, except last chunk)
 *     responses:
 *       200:
 *         description: Chunk uploaded successfully
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
 *                   example: Chunk uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     partNumber:
 *                       type: integer
 *                       example: 1
 *                     eTag:
 *                       type: string
 *                       description: S3 ETag for this chunk
 *                     uploadedChunks:
 *                       type: integer
 *                       description: Number of chunks uploaded so far
 *                     totalChunks:
 *                       type: integer
 *                       description: Total number of chunks
 *       400:
 *         description: Validation error or missing chunk data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/upload", chunkUpload.single("chunk"), uploadChunkHandler);

/**
 * @swagger
 * /files/chunk/complete:
 *   post:
 *     tags: [Chunked Upload]
 *     summary: Complete chunked upload
 *     description: Finalize the upload after all chunks have been uploaded
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *             properties:
 *               uploadId:
 *                 type: string
 *                 description: Upload session ID
 *     responses:
 *       200:
 *         description: Upload completed successfully
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
 *                   example: Upload completed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: File ID in database
 *                     fileName:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     fileType:
 *                       type: string
 *                       example: video
 *                     fileSize:
 *                       type: number
 *                     fileUrl:
 *                       type: string
 *                       description: Public URL to access the file
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or incomplete upload
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/complete", completeUpload);

/**
 * @swagger
 * /files/chunk/abort:
 *   post:
 *     tags: [Chunked Upload]
 *     summary: Abort chunked upload
 *     description: Cancel an ongoing upload session and clean up partial data
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *             properties:
 *               uploadId:
 *                 type: string
 *                 description: Upload session ID to abort
 *     responses:
 *       200:
 *         description: Upload aborted successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/abort", abortUpload);

/**
 * @swagger
 * /files/chunk/status/{uploadId}:
 *   get:
 *     tags: [Chunked Upload]
 *     summary: Get upload session status
 *     description: Retrieve the current status of an upload session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Upload session ID
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploadId:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     totalSize:
 *                       type: number
 *                     totalChunks:
 *                       type: number
 *                     uploadedChunks:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [initiated, uploading, completed, failed, aborted]
 *                     parts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partNumber:
 *                             type: integer
 *                           size:
 *                             type: integer
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Upload session not found
 *       500:
 *         description: Server error
 */
router.get("/status/:uploadId", getUploadStatusHandler);

export default router;
