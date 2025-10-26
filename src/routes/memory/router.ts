import { Router } from "express";
import {
  getMemoriesTimeline,
  getMemoriesByDate,
  deleteMemory,
  getActivityStats,
  syncMemories,
  getDashboard,
} from "../../controllers/memory.controller";
import { verifyToken } from "../../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * @route   GET /memories/dashboard
 * @desc    Get comprehensive dashboard with statistics and recent activities
 * @access  Private
 */
router.get("/dashboard", getDashboard);

/**
 * @route   GET /memories/timeline
 * @desc    Get user's memories timeline with daily grouping and pagination
 * @access  Private
 * @query   page (default: 1), limit (default: 20), activityType (optional)
 */
router.get("/timeline", getMemoriesTimeline);

/**
 * @route   GET /memories/date/:date
 * @desc    Get memories for a specific date (YYYY-MM-DD)
 * @access  Private
 */
router.get("/date/:date", getMemoriesByDate);

/**
 * @route   GET /memories/stats
 * @desc    Get activity statistics
 * @access  Private
 */
router.get("/stats", getActivityStats);

/**
 * @route   POST /memories/sync
 * @desc    Manually sync all activities to Memory model
 * @access  Private
 */
router.post("/sync", syncMemories);

/**
 * @route   DELETE /memories/:memoryId
 * @desc    Delete a specific memory
 * @access  Private
 */
router.delete("/:memoryId", deleteMemory);

export default router;
