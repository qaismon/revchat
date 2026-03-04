import mongoose, { Schema, models } from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  

  publicKey: { 
    type: String, 
    default: null 
  },
  
  isEncryptionEnabled: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);