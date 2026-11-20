import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { SPECIALIZATIONS } from '../../constants/specializations.js';
import { emailLocalPart, tokenize } from '../../utils/search.js';

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** Derived from name + email for index-backed prefix search. Never sent to clients. */
    searchTokens: { type: [String], select: false, default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        const { searchTokens: _tokens, ...rest } = ret;
        return rest;
      },
    },
  },
);

// Index design: Equality → Sort → Range.
doctorSchema.index({ searchTokens: 1 });
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ createdAt: -1 });
doctorSchema.index({ name: 1 });

doctorSchema.pre('validate', function () {
  this.searchTokens = tokenize(this.name, emailLocalPart(this.email));
});

export type DoctorAttrs = InferSchemaType<typeof doctorSchema>;
export type DoctorDocument = HydratedDocument<DoctorAttrs>;

export const Doctor = model('Doctor', doctorSchema);
