import express from 'express';
import authRouter from './auth/router';
import docsRouter from './docs';
import fileRouter from './file/router';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/docs', docsRouter);
router.use('/files', fileRouter);

export default router;