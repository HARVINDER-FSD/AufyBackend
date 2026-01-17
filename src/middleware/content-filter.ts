import { Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../lib/database';

const ADULT_KEYWORDS = ['sex', 'nude', 'porn', 'drugs', 'xxx', 'adult', 'nsfw'];

export const validateAgeAndContent = async (req: any, res: Response, next: NextFunction) => {
    try {
        const userId = req.userId;
        if (!userId) return next();

        const db = await getDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. Check if user is currently blocked
        if (user.isBlocked && user.blockedUntil && new Date() < new Date(user.blockedUntil)) {
            return res.status(403).json({
                status: 'blocked',
                message: 'Your account is temporarily blocked due to content violations',
                blockedUntil: user.blockedUntil
            });
        }

        // If blockedUntil has passed, reset block
        if (user.isBlocked && user.blockedUntil && new Date() >= new Date(user.blockedUntil)) {
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { isBlocked: false, blockedUntil: null, contentWarnings: 0 } }
            );
        }

        // 2. Check content for keywords
        const fieldsToCheck = ['content', 'caption', 'text', 'title', 'description', 'texts'];
        let hasAdultContent = false;
        let foundWord = '';

        for (const field of fieldsToCheck) {
            const fieldValue = req.body[field];
            if (typeof fieldValue === 'string') {
                const badWord = ADULT_KEYWORDS.find(word => fieldValue.toLowerCase().includes(word));
                if (badWord) {
                    hasAdultContent = true;
                    foundWord = badWord;
                    break;
                }
            } else if (Array.isArray(fieldValue)) {
                // Handle arrays (e.g., stories texts)
                for (const item of fieldValue) {
                    const strToTest = typeof item === 'string' ? item : (item.text || item.content || '');
                    const badWord = ADULT_KEYWORDS.find(word => strToTest.toLowerCase().includes(word));
                    if (badWord) {
                        hasAdultContent = true;
                        foundWord = badWord;
                        break;
                    }
                }
                if (hasAdultContent) break;
            }
        }

        // 3. AI Behavioral Check (Secondary Layer)
        // This helps catch minors who lie about their DOB but post adult content.
        const fullText = fieldsToCheck.map(f => req.body[f]).filter(Boolean).join(' ');
        const { safetyService } = await import('../services/ai/safetyService');
        const { estimatedAgeGroup } = await safetyService.estimateAgeFromBehavior(fullText);

        if (estimatedAgeGroup === 'minor') {
            const birthDate = new Date(user.dob || 0);
            const today = new Date();
            let declaredAge = today.getFullYear() - birthDate.getFullYear();

            // If they behave like a minor but claim to be adult, and content is adult-adjacent
            if (declaredAge >= 18 && hasAdultContent) {
                console.log(`⚠️ DISCREPANCY: User ${user.username} behaves like minor but claims age ${declaredAge}. Blocking content.`);

                await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $inc: { contentWarnings: 1 }, $set: { suspiciousBehavior: true } }
                );

                return res.status(403).json({
                    status: 'blocked',
                    message: 'Our AI has detected behavior inconsistent with your declared age. Content blocked for safety verification.',
                    ai_flag: 'AGE_DISCREPANCY'
                });
            }
        }

        if (hasAdultContent && !user.dob) {
            return res.status(400).json({
                success: false,
                message: 'Date of birth is required for content verification'
            });
        }

        if (hasAdultContent) {
            // Calculate Age
            const birthDate = new Date(user.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (age < 18) {
                // Increment warnings
                const newWarnings = (user.contentWarnings || 0) + 1;
                let updateFields: any = { contentWarnings: newWarnings };
                let message = `Content not allowed for users under 18. Warning ${newWarnings}/3.`;
                let status = 'warning';

                if (newWarnings >= 3) {
                    const blockedUntil = new Date();
                    blockedUntil.setHours(blockedUntil.getHours() + 24);
                    updateFields.isBlocked = true;
                    updateFields.blockedUntil = blockedUntil;
                    message = 'Account blocked for 24h due to 3 content violations.';
                    status = 'blocked';
                }

                await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: updateFields }
                );

                return res.status(403).json({
                    status: 'blocked',
                    message,
                    warnings: newWarnings,
                    blockedUntil: updateFields.blockedUntil || null
                });
            }
        }

        next();
    } catch (error: any) {
        console.error('Content filter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
