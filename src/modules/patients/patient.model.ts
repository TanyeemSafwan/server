import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CONDITIONS, GENDERS, PATIENT_STATUSES } from '../../constants/patients.js';
import { emailLocalPart, tokenize } from '../../utils/search.js';

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    condition: { type: String, required: true, enum: CONDITIONS },
    status: { type: String, required: true, enum: PATIENT_STATUSES, default: 'admitted' },
    admissionDate: { type: Date, required: true, default: () => new Date() },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    /** Derived from name, phone digits and email for index-backed prefix search. */
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
patientSchema.index({ doctor: 1, admissionDate: -1 });
patientSchema.index({ condition: 1, admissionDate: -1 });
patientSchema.index({ status: 1, admissionDate: -1 });
patientSchema.index({ admissionDate: -1 });
patientSchema.index({ searchTokens: 1 });

patientSchema.pre('validate', function () {
  // Phone digit groups ("555", "6543") and all digits ("15559876543") so either can be searched.
  const phoneDigits = this.phone?.replace(/\D/g, '');
  this.searchTokens = tokenize(this.name, this.phone, phoneDigits, emailLocalPart(this.email));
});

export type PatientAttrs = InferSchemaType<typeof patientSchema>;
export type PatientDocument = HydratedDocument<PatientAttrs>;

export const Patient = model('Patient', patientSchema);
