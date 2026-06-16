"use server";
import { verifySession } from "@/lib/dal/auth";
import { db } from "@/lib/db";
import {
  CreatePatternSchema,
  UpdatePatternSchema,
  type ActionState,
} from "@/lib/validations/pattern";
import {
  createPattern,
  updatePattern,
  deletePattern,
  getCategoryTypeForSubCategory,
} from "@/lib/dal/patterns";
import {
  canManageCustomPatterns,
  getCategorizationAccessConfig,
  type PlanGate,
} from "@/lib/config/categorization";
import { revalidateCategorizationSurfaces } from "@/lib/actions/revalidation";
import {
  applyNewPatternToExpenses,
  applyNewPatternToPlatformExpenses,
} from "@/lib/services/pattern-application";
import { getPlatformIdForUserFile } from "@/lib/dal/files";

function errorCause(error: unknown): unknown {
  return typeof error === "object" && error !== null && "cause" in error
    ? (error as { cause?: unknown }).cause
    : undefined;
}

function causeField(error: unknown, field: "message" | "code"): string {
  const cause = errorCause(error);
  if (typeof cause !== "object" || cause === null || !(field in cause)) {
    return "";
  }

  const value = (cause as Record<"message" | "code", unknown>)[field];
  return typeof value === "string" ? value : "";
}

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

  const subCategoryIdRaw = formData.get("subCategoryId")
    ? Number(formData.get("subCategoryId"))
    : undefined;

  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: subCategoryIdRaw,
    // amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
    confidence: Number(formData.get("confidence")),
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Validate subcategory scope (getCategoryTypeForSubCategory returns null if not visible)
  // Phase 46: amountSign derivation from category type removed (ADR 0012)
  const categoryType = await getCategoryTypeForSubCategory(parsed.data.subCategoryId, userId);
  if (!categoryType) {
    return { error: "Seleziona una sottocategoria valida." };
  }

  let created: Awaited<ReturnType<typeof createPattern>>;
  try {
    created = await createPattern({
      ...parsed.data,
      userId,
    });
  } catch (err) {
    const causeMsg = causeField(err, "message");
    const causeCode = causeField(err, "code");
    if (
      err instanceof Error &&
      /invalid|valido/i.test(err.message + causeMsg)
    ) {
      return { error: "Pattern regex non valido." };
    }
    if (
      causeCode === "23505" ||
      (err instanceof Error &&
        /unique.*constraint|duplicate key/i.test(err.message + causeMsg))
    ) {
      return { error: "Un pattern identico esiste già." };
    }
    console.error(
      "[createPatternAction] createPattern error:",
      err instanceof Error ? err.message : err,
      errorCause(err),
    );
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  try {
    await applyNewPatternToExpenses(
      db,
      userId,
      created.id,
      created.pattern,
      created.subCategoryId,
      // amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
      Number(created.confidence),
    );
  } catch (err) {
    console.error(
      '[createPatternAction] applyNewPatternToExpenses failed (pattern saved, retroactive apply failed):',
      err instanceof Error ? err.message : err,
      errorCause(err),
    )
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

  const subCategoryIdRaw = formData.get("subCategoryId")
    ? Number(formData.get("subCategoryId"))
    : undefined;

  const confidenceRaw = formData.get("confidence")
  const parsed = UpdatePatternSchema.safeParse({
    pattern: formData.get("pattern") || undefined,
    subCategoryId: subCategoryIdRaw,
    confidence: confidenceRaw !== null ? Number(confidenceRaw) : undefined,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Phase 46: amountSign derivation from category type removed (ADR 0012, patterns are sign-agnostic)
  // Validate subcategory scope if a subCategoryId is provided
  if (parsed.data.subCategoryId !== undefined) {
    const categoryType = await getCategoryTypeForSubCategory(parsed.data.subCategoryId, userId);
    if (!categoryType) {
      return { error: "Seleziona una sottocategoria valida." };
    }
  }

  try {
    const updated = await updatePattern(id, userId, {
      ...parsed.data,
    });
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

  // Phase 53-02: resolve platformId server-side from fileId (T-53-04, T-53-05).
  // fileId is provided by the hidden input on SuggestionPromoteForm.
  const fileId = formData.get("fileId");
  if (!fileId || typeof fileId !== "string" || fileId.trim() === "") {
    return { error: "File di import non valido." };
  }

  const platformId = await getPlatformIdForUserFile({ userId, fileId });
  if (platformId == null) {
    return { error: "Impossibile determinare la piattaforma per questo file." };
  }

  const subCategoryIdRaw = formData.get("subCategoryId")
    ? Number(formData.get("subCategoryId"))
    : undefined;

  // Parse only the fields we trust from the client (pattern, subCategoryId).
  // Phase 46: amountSign removed; confidence is hardcoded to 0.85 (D-01, WR-03).
  // Use a schema that omits confidence so no sentinel value is needed.
  const PromoteFormSchema = CreatePatternSchema.omit({ confidence: true });
  const parsed = PromoteFormSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: subCategoryIdRaw,
    // amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
    description: undefined, // Inline form does not collect a description (D-01).
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Validate subcategory scope
  const categoryType = await getCategoryTypeForSubCategory(parsed.data.subCategoryId, userId);
  if (!categoryType) {
    return { error: "Seleziona una sottocategoria valida." };
  }

  let created: Awaited<ReturnType<typeof createPattern>>;
  try {
    created = await createPattern({
      ...parsed.data,
      confidence: 0.85,
      userId,
    });
  } catch (err) {
    console.error(
      "[promoteSuggestionAction] createPattern error:",
      err instanceof Error ? err.message : err,
      errorCause(err),
    );

    const causeMsg = causeField(err, "message");
    const causeCode = causeField(err, "code");
    if (
      err instanceof Error &&
      /invalid|valido/i.test(err.message + causeMsg)
    ) {
      return { error: "Pattern regex non valido." };
    }
    if (
      causeCode === "23505" ||
      (err instanceof Error &&
        /unique.*constraint|duplicate key/i.test(err.message + causeMsg))
    ) {
      return { error: "Un pattern identico esiste già." };
    }
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }

  // Phase 53-02: platform-scoped retroactive apply (APPLY-01/02).
  // Replaces legacy user-wide applyNewPatternToExpenses on the promote path.
  // Apply failures are non-fatal: pattern is already saved; return zero counts.
  let applyResult = { updatedCount: 0, notUpdatedCount: 0 };
  try {
    applyResult = await applyNewPatternToPlatformExpenses(db, {
      userId,
      platformId,
      patternId: created.id,
      patternString: created.pattern,
      subCategoryId: created.subCategoryId,
      // amountSign removed — Phase 46: patterns are sign-agnostic (ADR 0012)
      confidence: Number(created.confidence),
    });
  } catch (err) {
    console.error(
      '[promoteSuggestionAction] applyNewPatternToPlatformExpenses failed (pattern saved, retroactive apply failed):',
      err instanceof Error ? err.message : err,
      errorCause(err),
    )
  }

  revalidateCategorizationSurfaces();
  return { error: null, applyResult };
}
