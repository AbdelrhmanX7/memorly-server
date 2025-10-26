import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILocation extends Document {
  userId: Types.ObjectId;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
locationSchema.index({ userId: 1, createdAt: -1 });

// Compound index to prevent duplicate locations for the same user
locationSchema.index({ userId: 1, location: 1 }, { unique: true });

export const Location = mongoose.model<ILocation>("Location", locationSchema);
