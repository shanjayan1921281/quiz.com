import { Request, Response, NextFunction } from 'express';
import { AuthService, AdminPayload } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  admin?: AdminPayload;
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const admin = AuthService.verifyToken(token);
    req.admin = admin;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: err.message || 'Token verification failed' },
    });
  }
}
