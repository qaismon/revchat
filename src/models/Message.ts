import mongoose, { Schema, models } from "mongoose";

const MessageSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // This is encrypted with the RECEIVER'S public key
    content: {
      type: String,
      required: true,
    },
    // ADD THIS: This is encrypted with the SENDER'S public key
    contentSender: {
      type: String,
      required: true,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default models.Message || mongoose.model("Message", MessageSchema);