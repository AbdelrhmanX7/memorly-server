import express from 'express';
import authRouter from './auth/router';
import docsRouter from './docs';
import fileRouter from './file/router';
import chatRouter from './chat/router';
import friendRouter from './friend/router';
import memoryRouter from './memory/router';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/docs', docsRouter);
router.use('/files', fileRouter);
router.use('/chat', chatRouter);
router.use('/friends', friendRouter);
router.use('/memories', memoryRouter);

export default router;