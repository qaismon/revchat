import mongoose, { Schema, models } from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  
  // --- ADDED FOR E2EE ---
  // We store this as a String (Base64) so it's easy to send over JSON
  publicKey: { 
    type: String, 
    default: null 
  },
  
  // Optional: Track if the user has encryption enabled
  isEncryptionEnabled: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);