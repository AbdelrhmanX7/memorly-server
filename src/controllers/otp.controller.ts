import { Request, Response } from "express";
import otpGenerator from "otp-generator";
import { User } from "../models/user";
import { Otp } from "../models/otp";
import {
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validation/auth.validation";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/email.service";
import { handleError } from "../utils/handle-error";

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = verifyEmailSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { email, otp } = value;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({
        success: false,
        message: "Email already verified",
      });
      return;
    }

    // Find valid OTP using userId for better security
    const otpRecord = await Otp.findOne({
      userId: user._id,
      otp,
      type: "email_verification",
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
      return;
    }

    // Update user as verified
    user.isVerified = true;
    await user.save();

    // Delete used OTP for this user
    await Otp.deleteMany({ userId: user._id, type: "email_verification" });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error: unknown) {
    console.error("Email verification error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const resendVerificationOtp = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = resendOtpSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { email } = value;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({
        success: false,
        message: "Email already verified",
      });
      return;
    }

    // Delete old OTPs for this user
    await Otp.deleteMany({ userId: user._id, type: "email_verification" });

    // Generate new OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Save OTP to database
    await Otp.create({
      userId: user._id,
      email,
      otp,
      type: "email_verification",
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      res.status(500).json({
        success: false,
        message: "Failed to send verification email",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Verification OTP sent to your email",
    });
  } catch (error: unknown) {
    console.error("Resend OTP error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = forgotPasswordSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { email } = value;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Delete old password reset OTPs for this user
    await Otp.deleteMany({ userId: user._id, type: "password_reset" });

    // Generate new OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Save OTP to database
    await Otp.create({
      userId: user._id,
      email,
      otp,
      type: "password_reset",
    });

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(email, otp);

    if (!emailSent) {
      res.status(500).json({
        success: false,
        message: "Failed to send password reset email",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
    });
  } catch (error: unknown) {
    console.error("Forgot password error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = resetPasswordSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { email, otp, newPassword } = value;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Find valid OTP using userId for better security
    const otpRecord = await Otp.findOne({
      userId: user._id,
      otp,
      type: "password_reset",
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Delete used OTP for this user
    await Otp.deleteMany({ userId: user._id, type: "password_reset" });

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error: unknown) {
    console.error("Reset password error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};
