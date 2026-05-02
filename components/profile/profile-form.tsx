'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { updateProfileAction } from '@/lib/actions/profile'
import type { UserProfile } from '@/lib/dal/users'

type Props = {
  profile: UserProfile
}

export function ProfileForm({ profile }: Props) {
  const [state, action, isPending] = useActionState(updateProfileAction, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success('Profilo aggiornato.')
      submittedRef.current = false
    }
  }, [state])

  return (
    <form
      action={(formData) => {
        submittedRef.current = true
        action(formData)
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Dati personali</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {state.error && (
            <Alert id="profile-form-error" variant="destructive" aria-live="polite">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-sm font-medium">
                Nome
              </label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                defaultValue={profile.firstName ?? ''}
                maxLength={80}
                autoComplete="given-name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-sm font-medium">
                Cognome
              </label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                defaultValue={profile.lastName ?? ''}
                maxLength={80}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="jobTitle" className="text-sm font-medium">
              Ruolo professionale
            </label>
            <Input
              id="jobTitle"
              name="jobTitle"
              type="text"
              defaultValue={profile.jobTitle ?? ''}
              maxLength={120}
              autoComplete="organization-title"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="location" className="text-sm font-medium">
              Località
            </label>
            <Input
              id="location"
              name="location"
              type="text"
              defaultValue={profile.location ?? ''}
              maxLength={120}
              autoComplete="address-level2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-sm font-medium">
              Telefono
            </label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ''}
              maxLength={40}
              autoComplete="tel"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className="text-sm font-medium">
              Fuso orario
            </label>
            <Input
              id="timezone"
              name="timezone"
              type="text"
              defaultValue={profile.timezone ?? 'Europe/Rome'}
              maxLength={64}
              placeholder="Europe/Rome"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button type="submit" disabled={isPending} aria-disabled={isPending}>
            {isPending ? 'Salvataggio…' : 'Salva modifiche'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
