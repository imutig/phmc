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
