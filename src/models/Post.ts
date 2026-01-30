import mongoose, { Schema, models } from "mongoose";

const PostSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 500,
    },
    image: {
      type: String,
      default: "",
    },
    mood: {
      type: String,
      enum: ["calm", "focused", "motivated", "thoughtful"],
      default: "thoughtful",
    },
    reactions: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        type: {
          type: String,
          enum: ["⚡", "🔥", "🧠", "💭"],
        },
      },
    ],
  },
  { timestamps: true }
);

export default models.Post || mongoose.model("Post", PostSchema);
