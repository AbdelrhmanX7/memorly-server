import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

export default function initGemini() {
  console.log("Start initializing gemini")

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  if (!ai) {
    throw new Error("Failed to initialize Gemini AI");
  }

  console.log("Gemini initialized")

  global.ai = ai;

}
