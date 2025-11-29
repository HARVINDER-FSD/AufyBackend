import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    // Check if email is configured
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('⚠️  Email not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env');
      return null;
    }

    transporter = nodemailer.createTransport(EMAIL_CONFIG);
  }
  return transporter;
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  to: string,
  resetToken: string,
  username: string
): Promise<boolean> => {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('📧 Email not configured, skipping email send');
    console.log(`📧 Reset token for ${to}: ${resetToken}`);
    return false;
  }

  const resetUrl = process.env.FRONTEND_URL 
    ? `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    : `http://localhost:8081/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"Anufy" <${EMAIL_CONFIG.auth.user}>`,
    to,
    subject: 'Reset Your Anufy Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #0095f6; font-size: 32px; font-weight: 700;">Anufy</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 0 40px 40px;">
                    <h2 style="margin: 0 0 20px; color: #262626; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                    
                    <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                      Hi ${username},
                    </p>
                    
                    <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                      We received a request to reset your password for your Anufy account. Click the button below to create a new password:
                    </p>
                    
                    <!-- Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0095f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 20px; color: #8e8e8e; font-size: 14px; line-height: 20px;">
                      Or copy and paste this link into your browser:
                    </p>
                    
                    <p style="margin: 0 0 20px; color: #0095f6; font-size: 14px; line-height: 20px; word-break: break-all;">
                      ${resetUrl}
                    </p>
                    
                    <div style="margin: 30px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid: #ffc107; border-radius: 4px;">
                      <p style="margin: 0; color: #856404; font-size: 14px; line-height: 20px;">
                        <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
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
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; border-top: 1px solid #dbdbdb; text-align: center;">
                    <p style="margin: 0 0 10px; color: #8e8e8e; font-size: 12px; line-height: 18px;">
                      This is an automated message, please do not reply to this email.
                    </p>
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
    text: `
Reset Your Anufy Password

Hi ${username},

We received a request to reset your password for your Anufy account.

Click the link below to create a new password:
${resetUrl}

⚠️ Important: This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Thanks,
The Anufy Team

---
This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} Anufy. All rights reserved.
    `.trim(),
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return false;
  }
};

/**
 * Send password changed notification email
 */
export const sendPasswordChangedEmail = async (
  to: string,
  username: string
): Promise<boolean> => {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('📧 Email not configured, skipping email send');
    return false;
  }

  const mailOptions = {
    from: `"Anufy" <${EMAIL_CONFIG.auth.user}>`,
    to,
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
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #0095f6; font-size: 32px; font-weight: 700;">Anufy</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 40px;">
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
    text: `
Password Changed

Hi ${username},

This is a confirmation that your Anufy account password was successfully changed on ${new Date().toLocaleString()}.

If you didn't make this change, please contact our support team immediately.

Thanks,
The Anufy Team
    `.trim(),
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Password changed notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password changed email:', error);
    return false;
  }
};

/**
 * Verify email configuration
 */
export const verifyEmailConfig = async (): Promise<boolean> => {
  const transport = getTransporter();
  
  if (!transport) {
    return false;
  }

  try {
    await transport.verify();
    console.log('✅ Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('❌ Email server verification failed:', error);
    return false;
  }
};
