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
        // Change the domain here to your EXACT verified domain in Resend
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
      // We usually don't throw here so the user registration doesn't fail just because an email bounced
    }
  },
};
