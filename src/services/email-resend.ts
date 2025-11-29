import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send password reset email using Resend
 */
export const sendPasswordResetEmail = async (
  to: string,
  resetToken: string,
  username: string
): Promise<boolean> => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY not configured');
    console.log(`📧 Reset token for ${to}: ${resetToken}`);
    return false;
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
  const resetUrl = `${backendUrl}/reset-password?token=${resetToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Anufy <onboarding@resend.dev>', // Use resend.dev domain for testing
      to: [to],
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
                  <!-- Header with Logo -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                      <div style="margin-bottom: 16px;">
                        <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                          <rect width="80" height="80" rx="16" fill="#ffffff"/>
                          <text x="40" y="55" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#667eea" text-anchor="middle">A</text>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Anufy</h1>
                      <p style="margin: 8px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Connect. Share. Inspire.</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #262626; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        Hi ${username},
                      </p>
                      
                      <p style="margin: 0 0 20px; color: #262626; font-size: 16px; line-height: 24px;">
                        We received a request to reset your password for your Anufy account. Click the button below to create a new password:
                      </p>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}" style="background-color: #0095f6; border: none; border-radius: 12px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 18px; font-weight: 700; line-height: 56px; text-align: center; text-decoration: none; width: 280px; box-shadow: 0 4px 12px rgba(0, 149, 246, 0.3);">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 20px 0; color: #8e8e8e; font-size: 14px; line-height: 20px; text-align: center;">
                        Click the button above to reset your password securely.
                      </p>
                      
                      <div style="margin: 30px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
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
    });

    if (error) {
      console.error('❌ Resend error:', error);
      console.log(`[FORGOT PASSWORD] Reset token for ${to}: ${resetToken}`);
      console.log(`[FORGOT PASSWORD] Reset link: ${resetUrl}`);
      return false;
    }

    console.log('✅ Password reset email sent via Resend:', data?.id);
    console.log(`📧 Reset link: ${resetUrl}`);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send password reset email:', error);
    console.log(`[FORGOT PASSWORD] Reset token for ${to}: ${resetToken}`);
    console.log(`[FORGOT PASSWORD] Reset link: ${resetUrl}`);
    return true; // Still return true so password reset flow continues
  }
};

/**
 * Send password changed notification email
 */
export const sendPasswordChangedEmail = async (
  to: string,
  username: string
): Promise<boolean> => {
  if (!process.env.RESEND_API_KEY) {
    console.log('📧 Email not configured, skipping email send');
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
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
                      <div style="margin-bottom: 16px;">
                        <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                          <rect width="80" height="80" rx="16" fill="#ffffff"/>
                          <text x="40" y="55" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#667eea" text-anchor="middle">A</text>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Anufy</h1>
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
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return false;
    }

    console.log('✅ Password changed notification sent via Resend:', data?.id);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password changed email:', error);
    return true;
  }
};
