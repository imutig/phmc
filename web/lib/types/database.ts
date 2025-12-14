// Types TypeScript générés depuis le schéma Supabase
// Ces types correspondent aux tables définies dans schema.sql

export type ApplicationService = 'EMS';

export type ApplicationStatus =
    | 'pending'
    | 'reviewing'
    | 'interview_scheduled'
    | 'interview_passed'
    | 'interview_failed'
    | 'training'
    | 'recruited'
    | 'rejected';

export type DocumentType = 'id_card' | 'driving_license' | 'weapon_permit' | 'cv';

export interface User {
    id: string;
    discord_id: string;
    discord_username: string;
    discord_discriminator?: string;
    avatar_url?: string;
    email?: string;
    is_recruiter: boolean;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
}

export interface Application {
    id: string;
    user_id: string;
    service: ApplicationService;
    status: ApplicationStatus;
    first_name: string;
    last_name: string;
    birth_date: string;
    seniority: string;
    motivation: string;
    availability: string;
    discord_channel_id?: string;
    interview_date?: string;
    created_at: string;
    updated_at: string;

    // Relations (optionnelles, pour les jointures)
    user?: User;
    documents?: ApplicationDocument[];
    logs?: ApplicationLog[];
    votes?: ApplicationVote[];
}

export interface ApplicationDocument {
    id: string;
    application_id: string;
    type: DocumentType;
    file_url: string;
    file_name?: string;
    created_at: string;
}

export interface ApplicationLog {
    id: string;
    application_id: string;
    actor_discord_id: string;
    actor_name?: string;
    action: string;
    details?: Record<string, unknown>;
    created_at: string;
}

export interface ApplicationVote {
    id: string;
    application_id: string;
    voter_discord_id: string;
    voter_name?: string;
    vote: boolean;
    comment?: string;
    created_at: string;
}

export interface ApplicationMessage {
    id: string;
    application_id: string;
    sender_discord_id: string;
    sender_name?: string;
    content: string;
    is_from_candidate: boolean;
    created_at: string;
}

export interface MessageTemplate {
    id: string;
    key: string;
    service: string;
    title: string;
    content: string;
    updated_at: string;
}

export interface Config {
    key: string;
    value: unknown;
    updated_at: string;
}

export interface Blacklist {
    id: string;
    discord_id: string;
    reason?: string;
    banned_by_discord_id: string;
    banned_at: string;
}

// Types pour les formulaires
export interface ApplicationFormData {
    service: ApplicationService;
    firstName: string;
    lastName: string;
    birthDate: string;
    seniority: string;
    motivation: string;
    availability: string;
}

// Status labels pour l'affichage
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
    pending: 'En attente',
    reviewing: 'En cours d\'examen',
    interview_scheduled: 'Entretien planifié',
    interview_passed: 'Entretien réussi',
    interview_failed: 'Entretien échoué',
    training: 'En formation',
    recruited: 'Recruté',
    rejected: 'Refusé',
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    reviewing: 'bg-blue-500/20 text-blue-400',
    interview_scheduled: 'bg-purple-500/20 text-purple-400',
    interview_passed: 'bg-green-500/20 text-green-400',
    interview_failed: 'bg-red-500/20 text-red-400',
    training: 'bg-cyan-500/20 text-cyan-400',
    recruited: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
};
