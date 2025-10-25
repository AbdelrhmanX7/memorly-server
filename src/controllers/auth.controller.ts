import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { User } from "../models/user";
import { Otp } from "../models/otp";
import { registerSchema, loginSchema } from "../validation/auth.validation";
import { sendVerificationEmail } from "../utils/email.service";
import { handleError } from "../utils/handle-error";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);

    if (error) {
      handleError({
        res,
        error: new Error(error.details.map((detail) => detail.message).join(", ")),
        statusCode: 400,
      });
      return;
    }

    const { username, email, password, dateOfBirth, acceptPrivacyPolicy } =
      value;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        handleError({
          res,
          error: new Error("Email already registered"),
          statusCode: 409,
        });
        return;
      }
      if (existingUser.username === username) {
        handleError({
          res,
          error: new Error("Username already taken"),
          statusCode: 409,
        });
        return;
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      dateOfBirth,
      acceptPrivacyPolicy,
    });

    await user.save();

    // Generate OTP for email verification
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
      // Still allow registration to succeed, user can request resend
      console.warn("Failed to send verification email to:", email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email.",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Registration error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      handleError({
        res,
        error: new Error(error.details.map((detail) => detail.message).join(", ")),
        statusCode: 400,
      });
      return;
    }

    const { email, password } = value;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      handleError({
        res,
        error: new Error("Invalid email or password"),
        statusCode: 401,
      });
      return;
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      handleError({
        res,
        error: new Error("Invalid email or password"),
        statusCode: 401,
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Login error:", error);
    handleError({
      res,
      error: error instanceof Error ? error : new Error("Internal server error"),
      statusCode: 500,
    });
  }
};
