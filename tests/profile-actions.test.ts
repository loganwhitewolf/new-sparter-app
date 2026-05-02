import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  updateUserProfile: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))

vi.mock('@/lib/dal/auth', () => ({
  verifySession: mocks.verifySession,
}))

vi.mock('@/lib/dal/users', () => ({
  updateUserProfile: mocks.updateUserProfile,
}))

vi.mock('@/lib/validations/profile', async () => {
  const actual = await vi.importActual<typeof import('../lib/validations/profile')>(
    '../lib/validations/profile',
  )
  return actual
})

const { updateProfileAction } = await import('../lib/actions/profile')

const userSession = {
  userId: 'user-abc',
  email: 'user@example.test',
  subscriptionPlan: 'free' as const,
  role: 'user' as const,
}

const updatedProfile = {
  firstName: 'Mario',
  lastName: 'Rossi',
  jobTitle: null,
  location: null,
  phone: null,
  timezone: null,
  email: 'user@example.test',
  subscriptionPlan: 'free' as const,
  role: 'user' as const,
  updatedAt: new Date('2026-05-02T00:00:00.000Z'),
}

function makeFormData(fields: Record<string, string | null>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      fd.append(key, value)
    }
  }
  return fd
}

describe('updateProfileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySession.mockResolvedValue(userSession)
    mocks.updateUserProfile.mockResolvedValue(updatedProfile)
  })

  // ── Happy path ────────────────────────────────────────────────────────────
  it('updates profile and revalidates /profile on success', async () => {
    const fd = makeFormData({ firstName: 'Mario', lastName: 'Rossi', jobTitle: '', location: '', phone: '', timezone: '' })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result).toEqual({ error: null })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/profile')
  })

  it('calls updateUserProfile with the session userId, never a userId from form data', async () => {
    const fd = makeFormData({
      firstName: 'Mario',
      lastName: 'Rossi',
      userId: 'attacker-id',
      email: 'evil@attacker.test',
      subscriptionPlan: 'pro',
      role: 'admin',
    })
    await updateProfileAction({ error: null }, fd)

    expect(mocks.updateUserProfile).toHaveBeenCalledWith(
      'user-abc',
      expect.not.objectContaining({ userId: expect.anything() }),
    )
    expect(mocks.updateUserProfile).toHaveBeenCalledWith(
      'user-abc',
      expect.not.objectContaining({ email: expect.anything() }),
    )
    expect(mocks.updateUserProfile).toHaveBeenCalledWith(
      'user-abc',
      expect.not.objectContaining({ subscriptionPlan: expect.anything() }),
    )
    expect(mocks.updateUserProfile).toHaveBeenCalledWith(
      'user-abc',
      expect.not.objectContaining({ role: expect.anything() }),
    )
  })

  it('passes only allowed profile columns to the DAL', async () => {
    const fd = makeFormData({ firstName: 'Mario', lastName: 'Rossi', jobTitle: '', location: '', phone: '', timezone: '' })
    await updateProfileAction({ error: null }, fd)

    expect(mocks.updateUserProfile).toHaveBeenCalledWith('user-abc', {
      firstName: 'Mario',
      lastName: 'Rossi',
      jobTitle: null,
      location: null,
      phone: null,
      timezone: null,
    })
  })

  // ── Authentication ────────────────────────────────────────────────────────
  it('propagates unauthenticated session failure without calling the DAL', async () => {
    mocks.verifySession.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))

    const fd = makeFormData({ firstName: 'Mario' })
    await expect(updateProfileAction({ error: null }, fd)).rejects.toThrow()
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  it('does not call DAL when verifySession returns no userId', async () => {
    mocks.verifySession.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }))

    const fd = makeFormData({ firstName: 'Mario' })
    await expect(updateProfileAction({ error: null }, fd)).rejects.toThrow()
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  // ── Validation failures ───────────────────────────────────────────────────
  it('returns an Italian validation error for an oversized firstName without calling the DAL', async () => {
    const fd = makeFormData({ firstName: 'a'.repeat(81) })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).toMatch(/80 caratteri/)
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  it('returns a validation error for an invalid phone format', async () => {
    const fd = makeFormData({ phone: 'not_a_phone!!!' })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).toMatch(/telefono/)
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  it('returns a validation error for an invalid timezone', async () => {
    const fd = makeFormData({ timezone: 'Invalid/Zone' })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).toMatch(/fuso orario/)
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  it('returns a validation error for an oversized lastName without calling the DAL', async () => {
    const fd = makeFormData({ lastName: 'b'.repeat(81) })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).toMatch(/80 caratteri/)
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  // ── Null/empty field normalisation ────────────────────────────────────────
  it('converts omitted fields to null in DAL payload', async () => {
    // Form data with no optional fields submitted
    const fd = new FormData()
    await updateProfileAction({ error: null }, fd)

    expect(mocks.updateUserProfile).toHaveBeenCalledWith('user-abc', {
      firstName: null,
      lastName: null,
      jobTitle: null,
      location: null,
      phone: null,
      timezone: null,
    })
  })

  it('converts empty-string fields to null in DAL payload', async () => {
    const fd = makeFormData({ firstName: '   ', lastName: '   ', jobTitle: '' })
    await updateProfileAction({ error: null }, fd)

    expect(mocks.updateUserProfile).toHaveBeenCalledWith('user-abc', {
      firstName: null,
      lastName: null,
      jobTitle: null,
      location: null,
      phone: null,
      timezone: null,
    })
  })

  // ── DAL failure modes ─────────────────────────────────────────────────────
  it('returns a generic Italian error and does not revalidate when DAL throws', async () => {
    mocks.updateUserProfile.mockRejectedValueOnce(new Error('connection pool exhausted'))

    const fd = makeFormData({ firstName: 'Mario' })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).toMatch(/errore/)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('returns a safe not-found error when DAL returns null (user row missing)', async () => {
    mocks.updateUserProfile.mockResolvedValueOnce(null)

    const fd = makeFormData({ firstName: 'Mario' })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).toMatch(/Profilo non trovato/)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('does not leak stack trace or DB internals in error responses', async () => {
    mocks.updateUserProfile.mockRejectedValueOnce(new Error('FATAL: password authentication failed for user "db_admin"'))

    const fd = makeFormData({ firstName: 'Mario' })
    const result = await updateProfileAction({ error: null }, fd)

    expect(result.error).not.toContain('FATAL')
    expect(result.error).not.toContain('password')
    expect(result.error).not.toContain('db_admin')
  })
})
