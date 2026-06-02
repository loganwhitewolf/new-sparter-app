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
import { deriveAmountSign } from "@/lib/validations/pattern";
import {
  canManageCustomPatterns,
  getCategorizationAccessConfig,
  type PlanGate,
} from "@/lib/config/categorization";
import { revalidateCategorizationSurfaces } from "@/lib/actions/revalidation";
import { applyNewPatternToExpenses } from "@/lib/services/pattern-application";

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

  // Parse only the fields we trust from the client (pattern, subCategoryId, description).
  // amountSign and confidence are derived/hardcoded server-side (ADR 0008, T-39-09).
  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: subCategoryIdRaw,
    // Provide placeholder values that satisfy the schema; they will be overridden below.
    amountSign: "any",
    confidence: 1,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Derive amountSign server-side from the subcategory's category type (ADR 0008, T-39-10).
  const categoryType = await getCategoryTypeForSubCategory(parsed.data.subCategoryId, userId);
  if (!categoryType) {
    return { error: "Seleziona una sottocategoria valida." };
  }
  const derivedAmountSign = deriveAmountSign(categoryType);

  let created: Awaited<ReturnType<typeof createPattern>>;
  try {
    created = await createPattern({
      ...parsed.data,
      amountSign: derivedAmountSign,
      confidence: 1,
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
      created.amountSign,
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

  // Parse only the fields we trust from the client (pattern, subCategoryId, description).
  // amountSign and confidence are derived/hardcoded server-side (ADR 0008, T-39-09).
  const parsed = UpdatePatternSchema.safeParse({
    pattern: formData.get("pattern") || undefined,
    subCategoryId: subCategoryIdRaw,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Derive amountSign server-side when a subCategoryId is provided (ADR 0008, T-39-10).
  let derivedAmountSign: 'positive' | 'negative' | 'any' | undefined;
  if (parsed.data.subCategoryId !== undefined) {
    const categoryType = await getCategoryTypeForSubCategory(parsed.data.subCategoryId, userId);
    if (!categoryType) {
      return { error: "Seleziona una sottocategoria valida." };
    }
    derivedAmountSign = deriveAmountSign(categoryType);
  }

  try {
    const updated = await updatePattern(id, userId, {
      ...parsed.data,
      ...(derivedAmountSign !== undefined ? { amountSign: derivedAmountSign, confidence: 1 } : {}),
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

  const subCategoryIdRaw = formData.get("subCategoryId")
    ? Number(formData.get("subCategoryId"))
    : undefined;

  // Parse only the fields we trust from the client (pattern, subCategoryId).
  // amountSign is derived server-side; confidence is hardcoded to 1 (ADR 0008, T-39-09).
  const parsed = CreatePatternSchema.safeParse({
    pattern: formData.get("pattern"),
    subCategoryId: subCategoryIdRaw,
    amountSign: "any", // placeholder; overridden below
    confidence: 1,
    description: undefined, // Inline form does not collect a description (D-01).
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Derive amountSign server-side from the subcategory's category type (ADR 0008, T-39-10).
  const categoryType = await getCategoryTypeForSubCategory(parsed.data.subCategoryId, userId);
  if (!categoryType) {
    return { error: "Seleziona una sottocategoria valida." };
  }
  const derivedAmountSign = deriveAmountSign(categoryType);

  let created: Awaited<ReturnType<typeof createPattern>>;
  try {
    created = await createPattern({
      ...parsed.data,
      amountSign: derivedAmountSign,
      confidence: 1,
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

  try {
    await applyNewPatternToExpenses(
      db,
      userId,
      created.id,
      created.pattern,
      created.subCategoryId,
      created.amountSign,
      Number(created.confidence),
    );
  } catch (err) {
    console.error(
      '[promoteSuggestionAction] applyNewPatternToExpenses failed (pattern saved, retroactive apply failed):',
      err instanceof Error ? err.message : err,
      errorCause(err),
    )
  }

  revalidateCategorizationSurfaces();
  return { error: null };
}
