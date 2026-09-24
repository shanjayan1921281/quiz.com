import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[API Error]', {
    path: req.path,
    method: req.method,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'BAD_REQUEST',
      message: err.message || 'An unexpected error occurred',
    },
  });
}
