import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Valide un body de requête avec un schéma Zod
 * @param schema - Le schéma Zod à utiliser
 * @param body - Le body à valider
 * @returns Un objet avec success, data ou error
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
    | { success: true; data: T }
    | { success: false; error: z.ZodError } {
    const result = schema.safeParse(body);
    if (!result.success) {
        return { success: false, error: result.error };
    }
    return { success: true, data: result.data };
}

/**
 * Crée une réponse d'erreur de validation formatée
 */
export function validationErrorResponse(error: z.ZodError) {
    const formattedErrors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
    }));

    return NextResponse.json(
        {
            error: 'Validation échouée',
            details: formattedErrors
        },
        { status: 400 }
    );
}

// ============================================================================
// SCHÉMAS DE VALIDATION PARTAGÉS
// ============================================================================

/**
 * Schéma pour la création d'un patient
 */
export const PatientCreateSchema = z.object({
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    birthDate: z.string().min(1, 'Date de naissance requise'),
    fingerprint: z.string()
        .regex(/^\d{1,6}$/, 'L\'empreinte doit contenir 1 à 6 chiffres')
        .min(1, 'Empreinte requise'),
    phone: z.string().optional(),
    discordId: z.string().optional(),
});

/**
 * Schéma pour la mise à jour d'un patient
 */
export const PatientUpdateSchema = z.object({
    photo_url: z.string().url().optional().or(z.literal('')),
    address: z.string().optional(),
    blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']).optional(),
    allergies: z.string().optional(),
    medical_history: z.string().optional(),
    emergency_contact: z.string().optional(),
    emergency_phone: z.string().optional(),
    notes: z.string().optional(),
    fingerprint: z.string().regex(/^\d{0,6}$/).optional(),
});

/**
 * Schéma pour la création de rendez-vous
 */
export const AppointmentCreateSchema = z.object({
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
    reasonCategory: z.string().min(1, 'Catégorie requise'),
    reason: z.string().min(1, 'Motif requis'),
    fingerprint: z.string().regex(/^\d{1,6}$/, 'Empreinte invalide'),
});

export type PatientCreate = z.infer<typeof PatientCreateSchema>;
export type PatientUpdate = z.infer<typeof PatientUpdateSchema>;
export type AppointmentCreate = z.infer<typeof AppointmentCreateSchema>;
