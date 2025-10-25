import express, { Request, Response } from "express";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Memorly API Documentation",
    version: "1.0.0",
    baseUrl: "/api/v1",
    routes: {
      authentication: {
        register: {
          method: "POST",
          path: "/api/v1/auth/register",
          description: "Register a new user account",
          requiresAuth: false,
          body: {
            username: "string (3-30 chars)",
            email: "string (valid email)",
            password: "string (min 6 chars)",
            dateOfBirth: "date (ISO 8601, must be 13+ years old)",
            acceptPrivacyPolicy: "boolean (must be true)",
          },
        },
        login: {
          method: "POST",
          path: "/api/v1/auth/login",
          description: "Login to existing account",
          requiresAuth: false,
          body: {
            email: "string (valid email)",
            password: "string",
          },
        },
        verifyEmail: {
          method: "POST",
          path: "/api/v1/auth/verify-email",
          description: "Verify email address with OTP",
          requiresAuth: false,
          body: {
            email: "string (valid email)",
            otp: "string (6 digits)",
          },
        },
        resendVerificationOtp: {
          method: "POST",
          path: "/api/v1/auth/resend-verification-otp",
          description: "Resend verification OTP to email",
          requiresAuth: false,
          body: {
            email: "string (valid email)",
          },
        },
        forgotPassword: {
          method: "POST",
          path: "/api/v1/auth/forgot-password",
          description: "Request password reset OTP",
          requiresAuth: false,
          body: {
            email: "string (valid email)",
          },
        },
        resetPassword: {
          method: "POST",
          path: "/api/v1/auth/reset-password",
          description: "Reset password with OTP",
          requiresAuth: false,
          body: {
            email: "string (valid email)",
            otp: "string (6 digits)",
            newPassword: "string (min 6 chars)",
          },
        },
      },
    },
    authentication: {
      type: "Bearer Token (JWT)",
      header: "Authorization: Bearer <token>",
      tokenExpiry: "30 days",
    },
    notes: [
      "All OTPs expire after 10 minutes",
      "All timestamps are in ISO 8601 format (UTC)",
      "Passwords are hashed using bcrypt",
      "CORS is enabled for all origins in development",
    ],
  });
});

export default router;
