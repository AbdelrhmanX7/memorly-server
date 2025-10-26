import { GoogleGenAI } from "@google/genai";
import { IUser } from "../models/user";
import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      ai: GoogleGenAI;
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}
