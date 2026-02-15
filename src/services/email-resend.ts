
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Email Configuration
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Initialize Resend (Fallback)
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Nodemailer (Primary)
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Retry helper for failed email sends
const retryEmailSend = async (fn: () => Promise<any>, retries = 1): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries) throw error;
      console.log(`⚠️  Email send attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
    }
  }
};

/**
 * Send email using Nodemailer (Gmail/SMTP) - Primary
 * Falls back to Resend if Nodemailer fails
 */
const sendEmail = async ({ to, subject, html }: { to: string, subject: string, html: string }) => {
  // 1. Try Nodemailer (Gmail/SMTP) first
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      console.log(`[EMAIL] Sending via Nodemailer (${process.env.EMAIL_HOST})...`);
      console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
      
      const info = await transporter.sendMail({
        from: `"AnuFy" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      
      console.log('✅ Email sent via Nodemailer:', info.messageId);
      return { success: true, id: info.messageId };
    } catch (error: any) {
      console.error('❌ Nodemailer failed:', error.message);
      console.log('🔄 Falling back to Resend...');
    }
  }

  // 2. Fallback to Resend
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('[EMAIL] Sending via Resend...');
      const { data, error } = await resend.emails.send({
        from: 'AnuFy <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      });

      if (error) throw error;
      
      console.log('✅ Email sent via Resend:', data?.id);
      return { success: true, id: data?.id };
    } catch (error: any) {
      console.error('❌ Resend failed:', error.message || error);
    }
  }

  throw new Error('All email providers failed or not configured');
};

/**
 * Send identity verification OTP email
 */
export const sendIdentityVerificationOTPEmail = async (
  to: string,
  otp: string,
  username: string
): Promise<boolean> => {
  console.log('[EMAIL] Sending identity verification OTP email...');
  console.log('[EMAIL] To:', to);

  try {
    await retryEmailSend(() => sendEmail({
      to,
      subject: 'Verify Your Identity - Anufy',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333;">Verify Your Identity</h2>
            <p>Hi ${username},</p>
            <p>Use the OTP below to verify your identity:</p>
            <div style="background: #e3f2fd; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
              <h1 style="color: #1976d2; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p>This code expires in 10 minutes.</p>
          </div>
        </body>
        </html>
      `
    }));
    return true;
  } catch (error) {
    console.error('❌ Failed to send identity verification OTP email');
    console.log(`[OTP BACKUP] OTP for ${to}: ${otp}`);
    return true; // Return true to allow flow to continue
  }
};

/**
 * Send password reset OTP email
 */
export const sendPasswordResetOTPEmail = async (
  to: string,
  otp: string,
  username: string
): Promise<boolean> => {
  console.log('[EMAIL] Sending password reset OTP email...');
  console.log('[EMAIL] To:', to);

  try {
    await retryEmailSend(() => sendEmail({
      to,
      subject: 'Your AnuFy Password Reset OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>Hi ${username},</p>
            <p>Use the OTP below to reset your password:</p>
            <div style="background: #e3f2fd; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
              <h1 style="color: #1976d2; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p>This code expires in 10 minutes.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
        </html>
      `
    }));
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset OTP email');
    console.log(`[OTP BACKUP] OTP for ${to}: ${otp}`);
    return true;
  }
};

/**
 * Send password changed notification email
 */
export const sendPasswordChangedEmail = async (
  to: string,
  username: string
): Promise<boolean> => {
  console.log('[EMAIL] Sending password changed notification...');
  console.log('[EMAIL] To:', to);

  try {
    await retryEmailSend(() => sendEmail({
      to,
      subject: 'Your Anufy Password Was Changed',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333;">Password Changed</h2>
            <p>Hi ${username},</p>
            <p>Your password was successfully changed.</p>
            <p>If you didn't do this, please contact support immediately.</p>
          </div>
        </body>
        </html>
      `
    }));
    return true;
  } catch (error) {
    console.error('❌ Failed to send password changed email');
    return true;
  }
};
