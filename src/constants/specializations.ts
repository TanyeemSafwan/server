export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'ENT',
  'General Medicine',
  'Gynecology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Radiology',
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];
