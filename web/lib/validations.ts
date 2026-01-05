import { z } from 'zod'

// =============================================
// Schémas de validation pour les APIs
// =============================================

// --- Services ---
export const ServiceCreateSchema = z.object({
    start_time: z.string().datetime({ message: "Format date/heure invalide" }),
    end_time: z.string().datetime({ message: "Format date/heure invalide" }),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
    message: "L'heure de fin doit être après l'heure de début"
})

export const ServiceAdminCreateSchema = z.object({
    user_discord_id: z.string().min(1, "ID Discord requis"),
    user_name: z.string().min(1, "Nom requis"),
    grade_name: z.enum(['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
})

// --- Tarifs ---
export const CareCategorySchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    description: z.string().max(500).optional(),
    sort_order: z.number().int().min(0).default(0),
})

export const CareTypeSchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    price: z.number().min(0, "Prix doit être positif"),
    description: z.string().max(500).optional(),
    category_id: z.string().uuid("ID catégorie invalide"),
})

// --- Médicaments ---
export const MedicationSchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    dosage: z.string().max(200).optional(),
    duration: z.string().max(200).optional(),
    effects: z.string().max(1000).optional(),
    side_effects: z.string().max(1000).optional(),
})

// --- Wiki ---
export const WikiArticleSchema = z.object({
    title: z.string().min(1, "Titre requis").max(200),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug invalide (lettres minuscules, chiffres, tirets)"),
    content: z.string().default(''),
    category: z.string().max(50).default('general'),
    sort_order: z.number().int().min(0).default(0),
    is_published: z.boolean().default(true),
})

export const WikiArticleUpdateSchema = WikiArticleSchema.partial().omit({ slug: true })

// --- Grades ---
export const GradeSchema = z.object({
    name: z.string().min(1).max(50),
    display_name: z.string().min(1).max(100),
    salary_per_15min: z.number().int().min(0),
    max_weekly_salary: z.number().int().min(0),
    sort_order: z.number().int().min(0).default(0),
})

// --- Events ---
export const EventCreateSchema = z.object({
    title: z.string().min(1, "Titre requis").max(200),
    description: z.string().max(2000).optional(),
    category: z.string().max(50).default('general'),
    start_date: z.string().datetime({ message: "Date de début invalide" }),
    end_date: z.string().datetime({ message: "Date de fin invalide" }).optional(),
    is_published: z.boolean().default(true),
})

export const EventUpdateSchema = EventCreateSchema.partial()

// --- Patients ---
export const PatientCreateSchema = z.object({
    first_name: z.string().min(1, "Prénom requis").max(100),
    last_name: z.string().min(1, "Nom requis").max(100),
    phone_number: z.string().min(3).max(20).optional(),
    date_of_birth: z.string().optional(),
    notes: z.string().max(2000).optional(),
})

export const PatientUpdateSchema = PatientCreateSchema.partial()

// --- Medical Exams (USI) ---
export const MedicalExamSchema = z.object({
    patient_id: z.string().uuid("ID patient invalide"),
    visit_date: z.string().optional(),
    chief_complaint: z.string().max(500).optional(),
    vital_signs: z.object({
        blood_pressure: z.string().optional(),
        heart_rate: z.number().optional(),
        temperature: z.number().optional(),
        respiratory_rate: z.number().optional(),
        oxygen_saturation: z.number().optional(),
    }).optional(),
    physical_exam: z.string().max(2000).optional(),
    diagnosis: z.string().max(1000).optional(),
    treatment_plan: z.string().max(2000).optional(),
    status: z.enum(['draft', 'completed']).default('draft'),
})

export const MedicalExamUpdateSchema = MedicalExamSchema.partial().omit({ patient_id: true })

// --- Appointments ---
export const AppointmentCreateSchema = z.object({
    discord_username: z.string().min(1, "Pseudo Discord requis").max(100),
    reason_category: z.string().min(1, "Catégorie requise").max(100),
    reason_details: z.string().max(1000).optional(),
    preferred_date: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high']).default('medium'),
})

// --- Permissions ---
export const PermissionUpdateSchema = z.object({
    permission_key: z.string().min(1, "Permission requise"),
    granted: z.boolean(),
})

// =============================================
// Helper de validation
// =============================================

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string }

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): ValidationResult<T> {
    const result = schema.safeParse(body)
    if (result.success) {
        return { success: true, data: result.data }
    }
    const errors = result.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
    return { success: false, error: errors }
}

