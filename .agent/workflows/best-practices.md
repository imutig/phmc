---
description: Bonnes pratiques et checklist de développement pour le projet Secrétaire Spades
---

# ✅ Checklist de Développement - Secrétaire Spades

## 🎯 À vérifier AVANT de commencer une feature

### 1. Permissions Granulaires (OBLIGATOIRE)

> ⚠️ **Règle d'or** : Chaque feature doit avoir sa propre permission granulaire.
> Ne PAS utiliser les fonctions `requireEditorAccess()` ou `requireAdminAccess()` seules.

#### Workflow pour une nouvelle feature :

1. **Identifier la permission nécessaire** (ex: `events.create`, `wiki.edit`, `services.delete`)
2. **Vérifier si elle existe** dans la table `permissions` ou via `/intranet/permissions`
3. **Si elle n'existe pas → la créer** :
   - Ajouter dans la page Permissions (UI)
   - Ou via migration SQL
4. **Implémenter la vérification** dans le code :

```typescript
// Dans l'API route
import { hasPermission } from "@/lib/auth-utils"

export async function POST(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // ✅ Vérification permission granulaire
    const canCreate = await hasPermission(authResult.session, 'events.create')
    if (!canCreate) {
        return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 })
    }
    
    // ... reste du code
}
```

#### Permissions existantes (référence) :
| Catégorie | Permissions |
|-----------|-------------|
| **wiki** | `wiki.edit`, `wiki.delete` |
| **events** | `events.create`, `events.edit`, `events.delete` |
| **services** | `services.manage` (admin des services) |
| **tarifs** | `tarifs.edit` |
| **medications** | `medications.edit` |
| **candidatures** | `candidatures.view`, `candidatures.manage` |
| **effectif** | `effectif.view`, `effectif.edit` |

#### Convention de nommage :
- Format : `{ressource}.{action}`
- Actions courantes : `view`, `create`, `edit`, `delete`, `manage`
- Exemples : `patients.create`, `ordonnances.view`, `planning.edit`

---

## 🔧 Standards API (routes dans `app/api/`)

### Validation Zod obligatoire
```typescript
import { validateBody, MonSchema } from "@/lib/validations"

const body = await request.json()
const validation = validateBody(MonSchema, body)
if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
}
const { field1, field2 } = validation.data
```

### Schémas existants à utiliser
- `ServiceCreateSchema` - Création de service
- `CareTypeSchema` - Types de soins
- `MedicationSchema` - Médicaments
- `GradeSchema` - Grades/salaires
- `WikiArticleSchema` / `WikiArticleUpdateSchema` - Articles wiki
- `PatientCreateSchema` / `PatientUpdateSchema` - Patients
- `AppointmentCreateSchema` - Rendez-vous

### Structure de réponse d'erreur
```typescript
// Erreur validation
{ error: "Message clair", details: [...] } // 400

// Non authentifié
{ error: "Non authentifié" } // 401

// Non autorisé
{ error: "Non autorisé" } // 403

// Non trouvé
{ error: "Ressource non trouvée" } // 404
```

---

## 🪝 Custom Hooks à utiliser

### Import centralisé
```typescript
import { useFetch, useDebounce, useRealtime } from '@/hooks'
```

### Patterns recommandés

#### Fetch de données
```typescript
// ❌ ÉVITER
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
useEffect(() => { fetch(...) }, [])

// ✅ UTILISER
const { data, loading, error, refetch } = useFetch<Event[]>('/api/events')
```

#### Mutations (POST/PUT/DELETE)
```typescript
const { mutate, loading } = useMutation('/api/events', 'POST')
const handleSubmit = async () => {
    const result = await mutate({ title: 'Mon event' })
    if (result) toast.success('Créé!')
}
```

#### Debounce pour recherche
```typescript
const [search, setSearch] = useState('')
const debouncedSearch = useDebounce(search, 300)
// Utiliser debouncedSearch pour les requêtes
```

#### Realtime Supabase
```typescript
useRealtime({
    table: 'services',
    onInsert: (s) => setServices(prev => [...prev, s]),
    onUpdate: (s) => setServices(prev => prev.map(x => x.id === s.id ? s : x)),
    onDelete: (s) => setServices(prev => prev.filter(x => x.id !== s.id))
})
```

---

## 🎨 Standards UI/UX

### États de chargement obligatoires
```typescript
// Utiliser le composant Skeleton
import { Skeleton } from '@/components/ui/Skeleton'

if (loading) return <Skeleton variant="card" />
// Variantes: 'text', 'card', 'chart', 'table'
```

### Notifications utilisateur
```typescript
import { useToast } from '@/contexts/ToastContext'
const { showToast } = useToast()

showToast('Opération réussie', 'success')
showToast('Erreur survenue', 'error')
showToast('Information', 'info')
```

### Classes CSS premium à utiliser
- `card-premium` - Effet glassmorphism sur les cartes
- `btn-magnetic` - Boutons interactifs
- `font-display` - Titres (Bebas Neue)
- `font-sans` - Corps de texte

---

## 🗄️ Standards Base de Données

### Requêtes optimisées
- Toujours utiliser les jointures Supabase : `.select('*, relation(*)')`
- Éviter les N+1 : ne pas faire de fetch dans une boucle
- Limiter les résultats : `.limit(50)`

### Index existants à exploiter
- `services`: `idx_services_time_range`, `idx_services_user_week`, `idx_services_deleted`
- `events`: `idx_events_date_type`, `idx_events_published_date`, `idx_events_deleted`
- `users`: `idx_users_discord_id`, `idx_users_grade`
- `wiki_articles`: `idx_wiki_deleted`
- `medications`, `care_types`, `care_categories`, `medical_exams`: `idx_*_deleted`

### Soft Delete (OBLIGATOIRE pour nouvelles tables)
Tables avec soft delete :
- `services`, `events`, `wiki_articles`, `medications`, `care_types`, `prescriptions`, `care_categories`, `medical_exams`

```typescript
// ✅ TOUJOURS filtrer les éléments supprimés dans les SELECT
const { data } = await supabase
    .from('services')
    .select('*')
    .is('deleted_at', null)  // ← OBLIGATOIRE
    .order('created_at', { ascending: false })

// ✅ DELETE = soft delete (pas de .delete())
await supabase
    .from('services')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
```

---

## 📝 Audit Logging (IMPLÉMENTÉ ✅)

### Quand logger (OBLIGATOIRE)
| Action | Tables concernées |
|--------|-------------------|
| **create** | Toutes les créations POST |
| **update** | Toutes les modifications PUT/PATCH |
| **delete** | Toutes les suppressions (soft delete) |
| **restore** | Restauration d'éléments supprimés |

### Comment utiliser `logAudit`
```typescript
import { logAudit } from '@/lib/audit'

// Après une création
await logAudit({
    actorDiscordId: session.user.discord_id,
    actorName: session.user.name,
    action: 'create',
    tableName: 'events',
    recordId: data.id,
    newData: data
})

// Après une modification
await logAudit({
    actorDiscordId: session.user.discord_id,
    actorName: session.user.name,
    action: 'update',
    tableName: 'events',
    recordId: id,
    oldData: existingRecord,  // Récupérer AVANT la modification
    newData: updatedRecord
})

// Après un soft delete
await logAudit({
    actorDiscordId: session.user.discord_id,
    actorName: session.user.name,
    action: 'delete',
    tableName: 'events',
    recordId: id,
    oldData: deletedRecord
})
```

### Tables avec audit logging actif
- `services` (POST, DELETE)
- `events` (POST, PUT, DELETE)
- `wiki_articles` (POST, PUT, DELETE)
- `care_categories` (POST, PUT, DELETE)
- `care_types` (POST, PUT, DELETE)
- `medications` (POST, PUT, DELETE)
- `patients` (POST, PATCH)
- `medical_exams` (POST, PATCH, DELETE)
- `permissions` (PUT, POST reset)
- `users` (IGN changes, sync from Discord)

### Accès aux logs
- Permission requise : `audit.view`
- Interface : `/intranet/audit`
- API : `/api/admin/audit`

---

## 🔍 Checklist finale avant PR

### Code
- [ ] TypeScript compile sans erreur (`npx tsc --noEmit`)
- [ ] Validation Zod sur tous les endpoints POST/PUT
- [ ] Utilisation des custom hooks (pas de fetch brut dans les composants)
- [ ] États loading avec Skeleton

### Sécurité
- [ ] Vérification des permissions appropriées
- [ ] Pas de données sensibles exposées côté client

### Audit & Soft Delete
- [ ] Audit logs ajoutés pour les actions create/update/delete
- [ ] Soft delete utilisé pour les suppressions (pas de `.delete()`)
- [ ] `.is('deleted_at', null)` ajouté aux SELECT

### UX
- [ ] Messages d'erreur clairs et en français
- [ ] Feedback utilisateur (toast) après chaque action
- [ ] Responsive design vérifié

### Performance
- [ ] Requêtes optimisées (jointures, limits)
- [ ] Debounce sur les inputs de recherche

