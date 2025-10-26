import { GoogleGenAI } from "@google/genai";
import { IUser } from "../models/user";

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
