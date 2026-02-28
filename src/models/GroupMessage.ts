import mongoose, { Schema, models } from "mongoose";

const GroupMessageSchema = new Schema(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default models.GroupMessage ||
  mongoose.model("GroupMessage", GroupMessageSchema);
