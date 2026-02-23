import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../lib/database'
import { getWebSocketService } from '../lib/websocket'
import { authenticateToken } from '../middleware/auth'
import {
  bruteForceProtection,
  recordFailedAttempt,
  clearFailedAttempts,
  validatePasswordStrength
} from '../middleware/security'
import { validate, loginSchema, registerSchema } from '../middleware/validation'
import { authLimiter } from '../middleware/rateLimiter'
import { generatePasswordResetToken, hash } from '../utils/encryption'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    console.log('[LOGIN] Attempt:', { email, passwordLength: password?.length });

    // Validate required fields
    if (!email || !password) {
      console.log('[LOGIN] Missing fields');
      return res.status(400).json({
        message: "Email and password are required"
      })
    }

    // Connect to MongoDB using shared connection
    const db = await getDatabase()
    const usersCollection = db.collection('users')

    console.log('[LOGIN] Connected to DB:', db.databaseName);
    console.log('[LOGIN] Collection:', usersCollection.collectionName);

    // Count total users
    const totalUsers = await usersCollection.countDocuments();
    console.log('[LOGIN] Total users in collection:', totalUsers);

    // Find user by email
    const user = await usersCollection.findOne({ email })
    console.log('[LOGIN] Query:', { email });

    console.log('[LOGIN] User found:', !!user, user ? `(${user.username})` : '');

    if (!user) {
      console.log('[LOGIN] User not found');
      recordFailedAttempt(email);
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    console.log('[LOGIN] Has password:', !!user.password);

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password)

    console.log('[LOGIN] Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[LOGIN] Invalid password');
      recordFailedAttempt(email);
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(email);

    // Generate JWT token (90 days - Instagram-style long session)
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    )

    // Set httpOnly cookie for server-side access
    res.cookie('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 90 * 1000, // 90 days in milliseconds
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    // Also set a non-httpOnly cookie for client-side access
    res.cookie('client-token', token, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 90 * 1000, // 7 days in milliseconds
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    // Record login activity
    try {
      const userAgent = req.headers['user-agent'] || 'Unknown'
      const ip = req.ip || '0.0.0.0'
      await db.collection('login_activity').insertOne({
        userId: user._id,
        device: userAgent,
        ip,
        location: 'Unknown', // Could use geoip here
        timestamp: new Date(),
        status: 'active'
      })
    } catch (activityError) {
      console.error('Failed to record login activity:', activityError)
    }

    // Return user data and token
    const avatarUrl = user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0095f6&color=fff&size=128`;

    return res.json({
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name || "",
        fullName: user.name || "",
        bio: user.bio || "",
        avatar: avatarUrl,
        avatar_url: avatarUrl,
        followers: user.followers || 0,
        following: user.following || 0,
        verified: user.verified || false
      },
      token: token
    })
  } catch (error: any) {
    console.error("Login error:", error)
    return res.status(error.status || 401).json({
      message: error.message || "Login failed"
    })
  }
})

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, username, full_name, dob } = req.body

    // Validate required fields
    if (!email || !password || !username || !dob) {
      return res.status(400).json({
        message: "Email, password, username, and date of birth are required"
      })
    }

    // Connect to MongoDB using shared connection
    const db = await getDatabase()
    const usersCollection = db.collection('users')

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_.]+$/
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message: 'Username can only contain letters, numbers, underscores (_), and periods (.)',
        error: 'INVALID_USERNAME_FORMAT'
      })
    }

    // Check username length
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        message: 'Username must be between 3 and 30 characters',
        error: 'INVALID_USERNAME_LENGTH'
      })
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { username }]
    })

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          message: "Email already registered"
        })
      } else {
        // Username is taken - generate suggestions
        const suggestions: string[] = []
        const baseUsername = username.replace(/[0-9]+$/, '') // Remove trailing numbers

        // Try adding random numbers
        for (let i = 0; i < 5; i++) {
          const randomNum = Math.floor(Math.random() * 9999) + 1
          const suggestion = `${baseUsername}${randomNum}`

          // Check if suggestion is available
          const exists = await usersCollection.findOne({ username: suggestion })
          if (!exists && suggestion.length <= 30) {
            suggestions.push(suggestion)
          }
        }

        // Try adding underscore and numbers
        if (suggestions.length < 5) {
          for (let i = 0; i < 3; i++) {
            const randomNum = Math.floor(Math.random() * 999) + 1
            const suggestion = `${baseUsername}_${randomNum}`

            const exists = await usersCollection.findOne({ username: suggestion })
            if (!exists && suggestion.length <= 30 && !suggestions.includes(suggestion)) {
              suggestions.push(suggestion)
            }
          }
        }

        return res.status(400).json({
          message: "Username already taken",
          error: 'USERNAME_TAKEN',
          suggestions: suggestions.slice(0, 5)
        })
      }
    }

    // Hash password (8 rounds for faster mobile performance)
    const hashedPassword = await bcrypt.hash(password, 8)

    // Create new user with proper avatar fields
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0095f6&color=fff&size=128`;

    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      username,
      name: full_name || username,
      full_name: full_name || username,
      bio: "",
      avatar: defaultAvatar,
      avatar_url: defaultAvatar,
      followers: 0,
      following: 0,
      followers_count: 0,
      following_count: 0,
      verified: false,
      is_verified: false,
      dob: dob ? new Date(dob) : null,
      contentWarnings: 0,
      isBlocked: false,
      blockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 🚀 Notify Admins in Real-time
    try {
      const wsService = getWebSocketService();
      wsService.notifyAdmin('new_user', {
        username,
        full_name: full_name || username,
        email,
        userId: result.insertedId.toString()
      });
    } catch (wsError) {
      console.warn('[WS] Failed to notify admins of new user');
    }

    // Generate JWT token (90 days - Instagram-style long session)
    const token = jwt.sign(
      {
        userId: result.insertedId.toString(),
        email,
        username,
        name: full_name || username
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    )

    // Set cookies
    res.cookie('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 90 * 1000, // 90 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    res.cookie('client-token', token, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    return res.json({
      user: {
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        username,
        email,
        name: full_name || username,
        fullName: full_name || username,
        bio: "",
        avatar: defaultAvatar,
        avatar_url: defaultAvatar,
        followers: 0,
        following: 0,
        verified: false
      },
      token
    })
  } catch (error: any) {
    console.error("Register error:", error)
    return res.status(500).json({
      message: error.message || "Registration failed"
    })
  }
})

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token')
  res.clearCookie('client-token')
  return res.json({ message: "Logged out successfully" })
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, you will receive an OTP.'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await usersCollection.updateOne(
      { email },
      {
        $set: {
          resetPasswordOTP: otp,
          resetPasswordOTPExpires: otpExpires,
          updated_at: new Date()
        }
      }
    );

    console.log(`[FORGOT PASSWORD] OTP generated for ${email}: ${otp}`);
    console.log(`[FORGOT PASSWORD] User: ${user.username}, Full Name: ${user.full_name}`);

    // Send OTP email (wait for it to complete)
    try {
      const { sendPasswordResetOTPEmail } = await import('../services/email-resend');
      console.log('[FORGOT PASSWORD] Calling sendPasswordResetOTPEmail...');
      await sendPasswordResetOTPEmail(email, otp, user.username || user.full_name);
      console.log('[FORGOT PASSWORD] Email sent successfully');
    } catch (importErr) {
      console.error('[FORGOT PASSWORD] Email send error:', importErr);
      // Continue anyway - OTP is stored in DB
    }

    // Respond after email is sent
    res.json({
      message: 'If an account exists with this email, you will receive an OTP.',
      // Dev helper: return OTP in response if not in production (since email might fail on free tier)
      dev_otp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });

  } catch (error) {
    console.error('[FORGOT PASSWORD] Error:', error);
    res.status(500).json({ message: 'Failed to process request' });
  }
});

// GET /api/auth/validate-reset-token - Validate if reset token is valid
router.get('/validate-reset-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Token is required', valid: false });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Hash the token to compare with stored hash
    const tokenHash = hash(token);

    // Find user with valid reset token
    const user = await usersCollection.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token', valid: false });
    }

    return res.json({ message: 'Token is valid', valid: true });
  } catch (error) {
    console.error('[VALIDATE TOKEN] Error:', error);
    return res.status(500).json({ message: 'Failed to validate token', valid: false });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Hash the token to compare with stored hash
    const tokenHash = hash(token);

    // Find user with valid reset token
    const user = await usersCollection.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updated_at: new Date()
        },
        $unset: {
          resetPasswordToken: '',
          resetPasswordExpires: ''
        }
      }
    );

    console.log(`[RESET PASSWORD] Password reset successful for user: ${user.email}`);

    // Send confirmation email asynchronously (don't wait for it)
    const { sendPasswordChangedEmail } = await import('../services/email-resend');
    sendPasswordChangedEmail(user.email, user.username || user.full_name).catch(err => {
      console.error('[RESET PASSWORD] Email send error:', err);
    });

    res.json({ message: 'Password reset successful. You can now login with your new password.' });

  } catch (error) {
    console.error('[RESET PASSWORD] Error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: 'New password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: decoded.userId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updated_at: new Date()
        }
      }
    );

    console.log(`[CHANGE PASSWORD] Password changed successfully for user: ${user.email}`);

    // Send confirmation email asynchronously (don't wait for it)
    const { sendPasswordChangedEmail } = await import('../services/email-resend');
    sendPasswordChangedEmail(user.email, user.username || user.full_name).catch(err => {
      console.error('[CHANGE PASSWORD] Email send error:', err);
    });

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('[CHANGE PASSWORD] Error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// GET /api/auth/login-activity - Get user's login history
router.get('/login-activity', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId
    const db = await getDatabase()

    const activity = await db.collection('login_activity')
      .find({ userId: new ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray()

    res.json({
      success: true,
      activity: activity.map(a => ({
        id: a._id,
        device: a.device,
        ip: a.ip,
        location: a.location,
        timestamp: a.timestamp,
        status: a.status
      }))
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/auth/verify-otp - Verify OTP for password reset
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    console.log('[OTP VERIFY] Attempting to verify:', { email, otp, otpType: typeof otp });

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('[OTP VERIFY] User found:', {
      email: user.email,
      storedOTP: user.resetPasswordOTP,
      storedOTPType: typeof user.resetPasswordOTP,
      otpExpires: user.resetPasswordOTPExpires,
      now: new Date(),
      isExpired: user.resetPasswordOTPExpires ? new Date() > user.resetPasswordOTPExpires : 'no expiry'
    });

    // Convert both to strings for comparison
    const storedOTP = String(user.resetPasswordOTP).trim();
    const providedOTP = String(otp).trim();

    console.log('[OTP VERIFY] Comparison:', { storedOTP, providedOTP, match: storedOTP === providedOTP });

    // Check if OTP matches and is not expired
    if (storedOTP !== providedOTP) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (!user.resetPasswordOTPExpires || new Date() > user.resetPasswordOTPExpires) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    console.log(`[OTP VERIFY] OTP verified for user: ${email}`);

    // OTP is valid, return success
    res.json({
      message: 'OTP verified successfully',
      verified: true
    });

  } catch (error) {
    console.error('[OTP VERIFY] Error:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

// POST /api/auth/reset-password-otp - Reset password using OTP
router.post('/reset-password-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify OTP - Convert both to strings for comparison
    const storedOTP = String(user.resetPasswordOTP).trim();
    const providedOTP = String(otp).trim();

    console.log('[RESET PASSWORD OTP] OTP Comparison:', { storedOTP, providedOTP, match: storedOTP === providedOTP });

    if (storedOTP !== providedOTP || !user.resetPasswordOTPExpires || new Date() > user.resetPasswordOTPExpires) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updated_at: new Date()
        },
        $unset: {
          resetPasswordOTP: '',
          resetPasswordOTPExpires: ''
        }
      }
    );

    console.log(`[RESET PASSWORD OTP] Password reset successful for user: ${email}`);

    // Generate JWT token for auto-login
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Send confirmation email asynchronously
    const { sendPasswordChangedEmail } = await import('../services/email-resend');
    sendPasswordChangedEmail(email, user.username || user.full_name).catch(err => {
      console.error('[RESET PASSWORD OTP] Email send error:', err);
    });

    // Return token for auto-login
    res.json({
      message: 'Password reset successful',
      token: token,
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name || "",
        fullName: user.name || "",
        bio: user.bio || "",
        avatar: user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0095f6&color=fff&size=128`,
        followers: user.followers || 0,
        following: user.following || 0,
        verified: user.verified || false
      }
    });

  } catch (error) {
    console.error('[RESET PASSWORD OTP] Error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// POST /api/auth/send-verification-otp
router.post('/send-verification-otp', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { targetEmail, targetPhone } = req.body;
    const db = await getDatabase();

    // Check if target email/phone already exists
    if (targetEmail) {
      const existingUser = await db.collection('users').findOne({
        email: targetEmail,
        _id: { $ne: new ObjectId(userId) }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    if (targetPhone) {
      const existingUser = await db.collection('users').findOne({
        phone: targetPhone,
        _id: { $ne: new ObjectId(userId) }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Phone number already exists' });
      }
    }

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          contactUpdateOTP: otp,
          contactUpdateOTPExpires: otpExpires,
          updated_at: new Date()
        }
      }
    );

    console.log(`[IDENTITY VERIFY] OTP generated for ${user.email}: ${otp}`);

    // Send OTP email (wait for it to complete)
    try {
      const { sendIdentityVerificationOTPEmail } = await import('../services/email-resend');
      await sendIdentityVerificationOTPEmail(user.email, otp, user.username || user.full_name);
      console.log('[IDENTITY VERIFY] Email sent successfully');
    } catch (importErr) {
      console.error('[IDENTITY VERIFY] Email send error:', importErr);
      // Continue anyway - OTP is stored in DB
    }

    // If user has phone, we would send SMS here
    if (user.phone) {
      console.log(`[IDENTITY VERIFY] Would send SMS to ${user.phone}: ${otp}`);
      // TODO: Implement SMS sending
    }

    res.json({ message: 'Verification OTP sent to your registered email' });

  } catch (error) {
    console.error('[IDENTITY VERIFY] Error:', error);
    res.status(500).json({ message: 'Failed to send verification OTP' });
  }
});

// POST /api/auth/verify-identity-otp
router.post('/verify-identity-otp', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check OTP
    if (user.contactUpdateOTP !== otp || !user.contactUpdateOTPExpires || new Date() > user.contactUpdateOTPExpires) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Generate verification token (short lived)
    const verificationToken = jwt.sign(
      {
        userId: userId,
        scope: 'update_contact',
        timestamp: Date.now()
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '10m' }
    );

    // Clear OTP
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: {
          contactUpdateOTP: "",
          contactUpdateOTPExpires: ""
        }
      }
    );

    res.json({
      message: 'Identity verified successfully',
      verificationToken: verificationToken
    });

  } catch (error) {
    console.error('[IDENTITY VERIFY] Error:', error);
    res.status(500).json({ message: 'Failed to verify identity' });
  }
});

export default router
