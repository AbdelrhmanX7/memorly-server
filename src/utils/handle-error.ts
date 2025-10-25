import { Response } from 'express';

export function handleError({ res, error, statusCode = 400 }: {
  res: Response;
  error: Error;
  statusCode?: number;
}): void {
  res.status(statusCode).send({ message: error.message });
}