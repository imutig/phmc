'use client';

import useSWR from 'swr';

// Fetcher par défaut
const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error('Erreur réseau');
    return r.json();
});

/**
 * Hook pour récupérer un patient par ID
 */
export function usePatient(id: string | undefined) {
    return useSWR(
        id ? `/api/patients/${id}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 30000, // 30 secondes
        }
    );
}

/**
 * Hook pour récupérer la liste des patients
 */
export function usePatients(search?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    return useSWR(
        `/api/patients?${params.toString()}`,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 10000, // 10 secondes
        }
    );
}

/**
 * Hook pour récupérer les examens médicaux d'un patient
 */
export function useMedicalExams(patientId: string | undefined) {
    return useSWR(
        patientId ? `/api/patients/${patientId}/medical-exams` : null,
        fetcher,
        {
            revalidateOnFocus: false,
        }
    );
}

/**
 * Hook pour récupérer le profil de l'utilisateur connecté
 */
export function useUserProfile() {
    return useSWR('/api/user/profile', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000, // 1 minute
    });
}

/**
 * Hook pour récupérer les services live
 */
export function useLiveServices() {
    return useSWR('/api/intranet/services/live', fetcher, {
        refreshInterval: 30000, // Rafraîchir toutes les 30 secondes
    });
}

/**
 * Hook pour récupérer les médicaments
 */
export function useMedications() {
    return useSWR('/api/intranet/medications', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 300000, // 5 minutes (données statiques)
    });
}

/**
 * Hook pour récupérer les tarifs
 */
export function useTarifs() {
    return useSWR('/api/intranet/tarifs', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 300000, // 5 minutes (données statiques)
    });
}
