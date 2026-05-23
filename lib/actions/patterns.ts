"use server";
import { verifySession } from "@/lib/dal/auth";
import {
  CreatePatternSchema,
  UpdatePatternSchema,
  type ActionState,
} from "@/lib/validations/pattern";
import {
  createPattern,
  updatePattern,
  deletePattern,
} from "@/lib/dal/patterns";
import {
  canManageCustomPatterns,
  getCategorizationAccessConfig,
  type PlanGate,
} from "@/lib/config/categorization";
import { revalidateCategorizationSurfaces } from "@/lib/actions/revalidation";

function customPatternsUnavailableMessage(currentPlan: PlanGate): string {
  const minPlan = getCategorizationAccessConfig().customPatternsMinPlan;

  if (minPlan === "basic") {
    return "I pattern personalizzati richiedono un piano Basic o Pro.";
  }

  if (minPlan === "pro") {
    if (currentPlan === "basic") {
      return "Il tuo piano Basic non include i pattern personalizzati. Passa al piano Pro.";
    }

    return "I pattern personalizzati richiedono un piano Pro.";
  }

  return "I pattern personalizzati non sono disponibili per il tuo piano.";
}

function requireCustomPatternsAccess(
  plan: "free" | "basic" | "pro",
): ActionState | null {
  if (!canManageCustomPatterns(plan)) {
    return { error: customPatternsUnavailableMessage(plan) };
  }

  return null;
}

export async function createPatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, subscriptionPlan } = await verifySession();

  const accessError = requireCustomPatternsAccess(subscriptionPlan);
  if (accessError) return accessError;

  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: formData.get("subCategoryId")
      ? Number(formData.get("subCategoryId"))
      : undefined,
    amountSign: formData.get("amountSign"),
    confidence: formData.get("confidence")
      ? Number(formData.get("confidence"))
      : undefined,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createPattern({ ...parsed.data, userId });
  } catch (err) {
    if (err instanceof Error && /invalid/i.test(err.message)) {
      return { error: "Pattern regex non valido." };
    }
    if (err instanceof Error && /unique.*constraint|duplicate key/i.test(err.message)) {
      return { error: "Un pattern identico esiste già." };
    }
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  revalidateCategorizationSurfaces();
  return { error: null };
}

export async function updatePatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, subscriptionPlan } = await verifySession();

  const accessError = requireCustomPatternsAccess(subscriptionPlan);
  if (accessError) return accessError;

  const id = Number(formData.get("id"));
  if (!id || isNaN(id)) return { error: "ID pattern mancante." };

  const parsed = UpdatePatternSchema.safeParse({
    pattern: formData.get("pattern") || undefined,
    subCategoryId: formData.get("subCategoryId")
      ? Number(formData.get("subCategoryId"))
      : undefined,
    amountSign: formData.get("amountSign") || undefined,
    confidence: formData.get("confidence")
      ? Number(formData.get("confidence"))
      : undefined,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const updated = await updatePattern(id, userId, parsed.data);
    if (!updated) return { error: "Pattern non trovato o accesso negato." };
  } catch {
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  revalidateCategorizationSurfaces();
  return { error: null };
}

export async function deletePatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, subscriptionPlan } = await verifySession();

  const accessError = requireCustomPatternsAccess(subscriptionPlan);
  if (accessError) return accessError;

  const id = Number(formData.get("id"));
  if (!id || isNaN(id)) return { error: "ID pattern mancante." };

  try {
    const deleted = await deletePattern(id, userId);
    if (!deleted) return { error: "Pattern non trovato o accesso negato." };
  } catch {
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  revalidateCategorizationSurfaces();
  return { error: null };
}

export async function promoteSuggestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession();
  // Per D-03 (35-CONTEXT.md): suggestion promotion is available to all plans,
  // including `free`. Intentionally NOT calling requireCustomPatternsAccess here.

  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: formData.get("subCategoryId")
      ? Number(formData.get("subCategoryId"))
      : undefined,
    amountSign: formData.get("amountSign"),
    confidence: 0.85, // Hardcoded per D-01; FormData `confidence` is intentionally NOT read (anti-tampering).
    description: undefined, // Inline form does not collect a description (D-01).
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createPattern({ ...parsed.data, userId });
  } catch (err) {
    if (err instanceof Error && /invalid/i.test(err.message)) {
      return { error: "Pattern regex non valido." };
    }
    if (err instanceof Error && /unique.*constraint|duplicate key/i.test(err.message)) {
      return { error: "Un pattern identico esiste già." };
    }
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  revalidateCategorizationSurfaces();
  return { error: null };
}
