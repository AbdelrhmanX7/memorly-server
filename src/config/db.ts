import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/99tech-problem5";

    await mongoose.connect(MONGODB_URI)

    console.log("Connected to MongoDB", MONGODB_URI);
  } catch {
    console.error("Failed to connect to MongoDB");
    process.exit(1);
  }
}