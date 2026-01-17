"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordChangedEmail = exports.sendPasswordResetOTPEmail = void 0;
const resend_1 = require("resend");
// Initialize Resend with timeout
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
// Retry helper for failed email sends
const retryEmailSend = (fn_1, ...args_1) => __awaiter(void 0, [fn_1, ...args_1], void 0, function* (fn, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            return yield fn();
        }
        catch (error) {
            if (i === retries)
                throw error;
            console.log(`⚠️  Email send attempt ${i + 1} failed, retrying...`);
            yield new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
});
/**
 * Send password reset OTP email using Resend
 */
const sendPasswordResetOTPEmail = (to, otp, username) => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.RESEND_API_KEY) {
        console.warn('⚠️  RESEND_API_KEY not configured');
        console.log(`📧 OTP for ${to}: ${otp}`);
        return false;
    }
    console.log('[EMAIL] Sending password reset OTP email...');
    console.log('[EMAIL] To:', to);
    console.log('[EMAIL] OTP:', otp);
    console.log('[EMAIL] API Key exists:', !!process.env.RESEND_API_KEY);
    try {
        const { data, error } = yield retryEmailSend(() => resend.emails.send({
            from: 'Anufy <onboarding@resend.dev>',
            to: [to],
            subject: 'Your AnuFy Password Reset OTP',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Anufy</h1>
                      <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Connect. Share. Inspire.</p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #262626; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        Hi ${username},
                      </p>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        We received a request to reset your password. Use the OTP below to verify your identity and reset your password in the AnuFy app:
                      </p>
                      
                      <div style="background-color: #f0f7ff; border: 2px solid #0095f6; border-radius: 12px; padding: 30px; text-align: center; margin: 40px 0;">
                        <p style="margin: 0 0 10px; color: #8e8e8e; font-size: 14px;">Your OTP Code</p>
                        <p style="margin: 0; color: #0095f6; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${otp}
                        </p>
                      </div>
                      
                      <p style="margin: 20px 0; color: #262626; font-size: 16px; line-height: 24px; text-align: center;">
                        Enter this code in the AnuFy app to verify your email and reset your password.
                      </p>
                      
                      <div style="margin: 30px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 20px;">
                          <strong>⚠️ Important:</strong> This OTP will expire in 10 minutes. Do not share this code with anyone.
                        </p>
                      </div>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                      </p>
                      
                      <p style="margin: 0; color: #262626; font-size: 16px; line-height: 24px;">
                        Thanks,<br>
                        The Anufy Team
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #dbdbdb; text-align: center;">
                      <p style="margin: 0; color: #8e8e8e; font-size: 12px; line-height: 18px;">
                        © ${new Date().getFullYear()} Anufy. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
        }));
        if (error) {
            console.error('❌ Resend error:', error);
            console.log(`[OTP] OTP for ${to}: ${otp}`);
            console.log('[EMAIL] Error details:', JSON.stringify(error, null, 2));
            return false;
        }
        console.log('✅ Password reset OTP email sent via Resend:', data === null || data === void 0 ? void 0 : data.id);
        console.log(`📧 OTP: ${otp}`);
        return true;
    }
    catch (error) {
        console.error('❌ Failed to send password reset OTP email:', error);
        console.log(`[OTP] OTP for ${to}: ${otp}`);
        console.log('[EMAIL] Error message:', error === null || error === void 0 ? void 0 : error.message);
        console.log('[EMAIL] Error code:', error === null || error === void 0 ? void 0 : error.code);
        return true; // Still return true so password reset flow continues
    }
});
exports.sendPasswordResetOTPEmail = sendPasswordResetOTPEmail;
/**
 * Send password changed notification email
 */
const sendPasswordChangedEmail = (to, username) => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.RESEND_API_KEY) {
        console.log('📧 Email not configured, skipping email send');
        return false;
    }
    console.log('[EMAIL] Sending password changed notification...');
    console.log('[EMAIL] To:', to);
    try {
        const { data, error } = yield retryEmailSend(() => resend.emails.send({
            from: 'Anufy <onboarding@resend.dev>',
            to: [to],
            subject: 'Your Anufy Password Was Changed',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Anufy</h1>
                      <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Connect. Share. Inspire.</p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #262626; font-size: 24px; font-weight: 600;">Password Changed</h2>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        Hi ${username},
                      </p>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        This is a confirmation that your Anufy account password was successfully changed.
                      </p>
                      
                      <div style="margin: 30px 0; padding: 16px; background-color: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                        <p style="margin: 0; color: #155724; font-size: 14px; line-height: 20px;">
                          <strong>✅ Confirmed:</strong> Your password was changed on ${new Date().toLocaleString()}.
                        </p>
                      </div>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        If you didn't make this change, please contact our support team immediately.
                      </p>
                      
                      <p style="margin: 0; color: #262626; font-size: 16px; line-height: 24px;">
                        Thanks,<br>
                        The Anufy Team
                      </p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #dbdbdb; text-align: center;">
                      <p style="margin: 0; color: #8e8e8e; font-size: 12px; line-height: 18px;">
                        © ${new Date().getFullYear()} Anufy. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
        }));
        if (error) {
            console.error('❌ Resend error:', error);
            return false;
        }
        console.log('✅ Password changed notification sent via Resend:', data === null || data === void 0 ? void 0 : data.id);
        return true;
    }
    catch (error) {
        console.error('❌ Failed to send password changed email:', error);
        return true;
    }
});
exports.sendPasswordChangedEmail = sendPasswordChangedEmail;
