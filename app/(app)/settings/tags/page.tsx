import { verifySession } from '@/lib/dal/auth'
import { getTags } from '@/lib/dal/tags'
import { TagSettingsPanel } from '@/components/tags/tag-settings-panel'

export const metadata = { title: 'Tag' }

export default async function TagsPage() {
  const { userId } = await verifySession()
  const tags = await getTags(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea e gestisci i tag per organizzare le tue transazioni.
        </p>
      </div>

      <TagSettingsPanel tags={tags} />
    </div>
  )
}
