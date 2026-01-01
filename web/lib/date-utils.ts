// ============================================================
// UTILITAIRES DE DATE
// ============================================================

/**
 * Calcule le numéro de semaine ISO et l'année ISO pour une date donnée.
 * L'année ISO peut différer de l'année civile (ex: 31 déc 2025 = semaine 1 de 2026)
 */
export function getISOWeekAndYear(date: Date): { week: number; year: number } {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const isoYear = d.getUTCFullYear()
    const yearStart = new Date(Date.UTC(isoYear, 0, 1))
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return { week, year: isoYear }
}

/**
 * Retourne la semaine et l'année ISO courantes
 */
export function getCurrentISOWeekAndYear(): { week: number; year: number } {
    return getISOWeekAndYear(new Date())
}

/**
 * Calcule la date d'un jour spécifique dans une semaine ISO donnée
 * @param week Numéro de semaine ISO (1-53)
 * @param year Année ISO
 * @param dayIndex Jour de la semaine (0=Lundi, 6=Dimanche)
 * @returns Date au format YYYY-MM-DD
 */
export function getDateOfISOWeek(week: number, year: number, dayIndex: number): string {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
    const dow = simple.getUTCDay()
    const ISOweekStart = simple
    if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
    else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())
    ISOweekStart.setUTCDate(ISOweekStart.getUTCDate() + dayIndex)
    return ISOweekStart.toISOString().split('T')[0]
}

/**
 * Formate une date ISO en heure HH:MM
 */
export function formatTime(isoString: string): string {
    const date = new Date(isoString)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Formate une durée en minutes en format lisible (ex: "1h30")
 */
export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins.toString().padStart(2, '0')}`
}
