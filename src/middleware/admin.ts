import { Request, Response, NextFunction } from 'express';
import User from '../models/user';

/**
 * Middleware to check if the authenticated user has an admin role.
 * Requires the 'authenticate' middleware to be called first to populate req.userId.
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        next();
    } catch (error: any) {
        console.error('[Admin Middleware] Error:', error.message);
        res.status(500).json({ message: 'Internal server error while verifying admin role.' });
    }
};

/**
 * Middleware to check if the user is at least a moderator or admin.
 */
export const isModerator = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'admin' && user.role !== 'moderator') {
            return res.status(403).json({ message: 'Access denied. Moderator or Admin role required.' });
        }

        next();
    } catch (error: any) {
        console.error('[Moderator Middleware] Error:', error.message);
        res.status(500).json({ message: 'Internal server error while verifying moderator role.' });
    }
};
