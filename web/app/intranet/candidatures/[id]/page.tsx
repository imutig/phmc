import { redirect } from "next/navigation"

interface Props {
    params: Promise<{ id: string }>
}

export default async function CandidatureDetailPage({ params }: Props) {
    const { id } = await params
    // Rediriger vers la page admin existante
    redirect(`/admin/${id}`)
}
