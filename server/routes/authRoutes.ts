import { Router } from 'express';
import { AuthService } from '../services/authService';
import { requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware';
import { loginLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/admin/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    const result = await AuthService.login(email, password);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/me', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: { admin: req.admin },
  });
});

export default router;
