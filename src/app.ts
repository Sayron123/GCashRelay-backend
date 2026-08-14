import express from 'express';
import transactionsRouter from './routes/transactions';

const app = express();
app.use(express.json());
app.use('/api/transactions', transactionsRouter);
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('unhandled error', err);
  res.status(500).json({ error: 'internal server error' });
});

export default app;