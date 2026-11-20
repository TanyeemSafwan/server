export const CONDITIONS = [
  'Allergy',
  'Arthritis',
  'Asthma',
  'Covid-19',
  'Depression',
  'Diabetes',
  'Flu',
  'Fracture',
  'Heart Disease',
  'Hypertension',
  'Migraine',
  'Other',
] as const;

export const PATIENT_STATUSES = ['admitted', 'under_treatment', 'recovered', 'discharged'] as const;

export const GENDERS = ['male', 'female', 'other'] as const;

export type Condition = (typeof CONDITIONS)[number];
export type PatientStatus = (typeof PATIENT_STATUSES)[number];
export type Gender = (typeof GENDERS)[number];
