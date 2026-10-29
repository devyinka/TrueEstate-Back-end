import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_DOMAIN_NAME = process.env.RESEND_DOMAIN_NAME;

// Initialize Resend with your API key
const resend = new Resend(RESEND_API_KEY);

export const emailService = {
  sendOtpEmail: async (toEmail: string, otpCode: string, firstName: string) => {
    try {
      await resend.emails.send({
        from: "TrueEstate <no-reply@" + RESEND_DOMAIN_NAME + ">",
        to: toEmail,
        subject: "Your TrueEstate Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to TrueEstate, ${firstName}!</h2>
            <p>Your account verification code is:</p>
            <h1 style="font-size: 32px; letter-spacing: 4px; color: #2E8B57;">${otpCode}</h1>
            <p>This code will expire in 15 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Failed to send OTP email:", error);
    }
  },

  sendTenantInvitation: async (
    toEmail: string,
    landlordName: string,
    inviteCode: string,
  ) => {
    try {
      await resend.emails.send({
        from: "TrueEstate <no-reply@" + RESEND_DOMAIN_NAME + ">",
        to: toEmail,
        subject: `Invitation to join your new home on TrueEstate by ${landlordName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #08745f;">Welcome to TrueEstate</h2>
            <p>Hello,</p>
            <p><strong>${landlordName}</strong> has invited you to connect to your new home on TrueEstate.</p>
            <p>To accept this invitation, please download the TrueEstate app, select the <strong>Tenant</strong> role during sign up, and enter the following 6-digit invitation code:</p>
            
            <div style="background-color: #f0fbf5; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">
                ${inviteCode}
              </span>
            </div>
            
            <p style="margin-top: 32px; font-size: 14px; color: #666;">
              If you did not expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Failed to send tenant invitation email:", error);
    }
  },

  sendAgentInvitation: async (
    toEmail: string,
    landlordName: string,
    inviteCode: string,
  ) => {
    try {
      await resend.emails.send({
        from: "TrueEstate <no-reply@" + RESEND_DOMAIN_NAME + ">",
        to: toEmail,
        subject: `Invitation to manage properties for ${landlordName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #08745f;">TrueEstate Agent Portal</h2>
            <p>Hello,</p>
            <p><strong>${landlordName}</strong> has invited you to join their team as a Property Manager on TrueEstate.</p>
            <p>To accept this invitation, please open the TrueEstate app, select the <strong>Agent</strong> role during sign up, and enter the following 6-digit invitation code:</p>
            
            <div style="background-color: #f0fbf5; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">
                ${inviteCode}
              </span>
            </div>
          </div>
        `,
      });
    } catch (error) {
      console.error("Failed to send agent invitation email:", error);
    }
  },

  sendPasswordResetEmail: async (
    toEmail: string,
    resetCode: string,
    firstName: string,
  ) => {
    try {
      await resend.emails.send({
        from: "TrueEstate <no-reply@" + RESEND_DOMAIN_NAME + ">",
        to: toEmail,
        subject: "Reset your TrueEstate Password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #08745f;">Password Reset Request</h2>
            <p>Hello ${firstName},</p>
            <p>We received a request to reset your TrueEstate password. Enter the following 6-digit code in the app to reset it:</p>
            
            <div style="background-color: #f0fbf5; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">
                ${resetCode}
              </span>
            </div>
            
            <p>This code will expire in 15 minutes.</p>
            <p style="margin-top: 32px; font-size: 14px; color: #666;">
              If you did not request a password reset, please ignore this email or contact support if you have concerns.
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  },
};
