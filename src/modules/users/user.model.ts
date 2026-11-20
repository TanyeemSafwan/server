import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '../../config/permissions.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'admin' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User = model('User', userSchema);
