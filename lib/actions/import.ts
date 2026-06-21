"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal/auth";
import {
  AnalyzeImportSchema,
  CreatePrivateImportFormatSchema,
  DeleteImportSchema,
  ImportFileSchema,
  LoadImportFormatWizardContextSchema,
  UpdateImportDisplayNameSchema,
  parseImportFilters,
  type ImportSearchParams,
} from "@/lib/validations/import";
import { analyzeFile, importFile } from "@/lib/services/import";
import type {
  ImportAnalysisResult,
  ImportFileResult,
} from "@/lib/services/import";
import {
  ImportFormatWizardError,
  createPrivateImportFormat,
  loadImportFormatWizardContext,
  type CreatePrivateImportFormatResult,
  type ImportFormatWizardContext,
} from "@/lib/services/import-format-wizard";
import {
  ImportDeleteError,
  deleteImport as deleteImportService,
  getImportDeletePreview,
  type ImportDeletePreview,
  type ImportDeleteResult,
} from "@/lib/services/import-deletion";
import {
  getImports,
  IMPORT_LIST_LIMIT,
  updateImportDisplayName,
} from "@/lib/dal/imports";
import { getFileForUser, getPlatformIdForUserFile } from "@/lib/dal/files";
import { discoverRegexCandidates } from "@/lib/services/regex-discovery";
import { db } from "@/lib/db";
import { file as fileTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  APP_ROUTES,
  ONBOARDING_AFTER_PRIVATE_PLATFORM_CREATION_ROUTE,
} from "@/lib/routes";

export type ImportActionState<T = null> = {
  error: string | null;
  data?: T;
};

export type CompleteOnboardingPrivateImportResult = ImportFileResult & {
  nextRoute: string;
};

type LoadMoreImportsInput = {
  filters?: ImportSearchParams;
  offset?: number;
};

type LoadMoreImportsResult = {
  imports: Awaited<ReturnType<typeof getImports>>;
  hasMore: boolean;
  error: string | null;
};

function normalizeOffset(offset: number | undefined): number {
  const normalizedOffset = offset ?? 0;

  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0) {
    return 0;
  }

  return normalizedOffset;
}

function mapImportDeleteError(error: unknown, operation: "preview" | "delete") {
  if (error instanceof ImportDeleteError) {
    switch (error.code) {
      case "invalid_file_id":
        return "Importazione non valida.";
      case "import_not_found":
        return "Importazione non trovata o accesso negato.";
      case "import_not_deletable":
        return operation === "delete"
          ? "Questa importazione non può essere eliminata o è già stata rimossa."
          : "Questa importazione non può essere eliminata in questo stato.";
      case "preview_failed":
        return "Impossibile calcolare l’impatto dell’eliminazione. Riprova tra qualche secondo.";
      case "delete_failed":
        return "Impossibile eliminare l’importazione. Riprova tra qualche secondo.";
    }
  }

  return operation === "preview"
    ? "Impossibile calcolare l’impatto dell’eliminazione. Riprova tra qualche secondo."
    : "Impossibile eliminare l’importazione. Riprova tra qualche secondo.";
}

function revalidateImportDeletionSurfaces() {
  revalidatePath(APP_ROUTES.import);
  revalidatePath(APP_ROUTES.expenses);
  revalidatePath(APP_ROUTES.transactions);
}

function mapImportFormatWizardError(error: unknown) {
  if (error instanceof ImportFormatWizardError) {
    switch (error.code) {
      case "invalid_input":
        return "Controlla i campi del formato e riprova.";
      case "file_not_found":
        return "Importazione non trovata o accesso negato.";
      case "file_read_failed":
        return "Impossibile leggere il file caricato. Riprova.";
      case "file_parse_failed":
        return "Impossibile leggere le intestazioni del file. Riprova.";
      case "column_not_found":
        return "Una o più colonne selezionate non esistono nel file caricato.";
      case "db_write_failed":
        return "Impossibile salvare il formato. Riprova.";
    }
  }

  return "Si è verificato un errore. Riprova tra qualche secondo.";
}

function revalidateImportWizardSurfaces() {
  revalidatePath(APP_ROUTES.import);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function optionalPositiveInteger(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : Number.NaN;
}

function invalidImportError() {
  return { error: "Importazione non valida." };
}

export async function loadImportFormatWizardContextAction(
  formData: FormData,
): Promise<ImportActionState<ImportFormatWizardContext>> {
  const parsed = LoadImportFormatWizardContextSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
  });

  if (!parsed.success) {
    return { error: "Importazione non valida." };
  }

  let userId: string;

  try {
    const session = await verifySession();
    userId = session.userId;
  } catch {
    return {
      error: "Sessione scaduta. Accedi di nuovo per configurare il formato.",
    };
  }

  try {
    const context = await loadImportFormatWizardContext({
      userId,
      fileId: parsed.data.fileId,
    });
    return { error: null, data: context };
  } catch (error) {
    return { error: mapImportFormatWizardError(error) };
  }
}

export async function createPrivateImportFormatAction(
  _prev: ImportActionState<CreatePrivateImportFormatResult>,
  formData: FormData,
): Promise<ImportActionState<CreatePrivateImportFormatResult>> {
  const parsed = CreatePrivateImportFormatSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
    platformName: formData.get("platformName") ?? "",
    delimiter: formString(formData, "delimiter"),
    timestampColumn: formData.get("timestampColumn") ?? "",
    descriptionColumn: formData.get("descriptionColumn") ?? "",
    amountMode: formString(formData, "amountMode"),
    amountColumn: formString(formData, "amountColumn"),
    positiveAmountColumn: formString(formData, "positiveAmountColumn"),
    negativeAmountColumn: formString(formData, "negativeAmountColumn"),
  });

  if (!parsed.success) {
    return { error: "Controlla i campi del formato e riprova." };
  }

  let userId: string;

  try {
    const session = await verifySession();
    userId = session.userId;
  } catch {
    return {
      error: "Sessione scaduta. Accedi di nuovo per configurare il formato.",
    };
  }

  let result: CreatePrivateImportFormatResult;
  try {
    result = await createPrivateImportFormat({ ...parsed.data, userId });
    revalidateImportWizardSurfaces();
  } catch (error) {
    return { error: mapImportFormatWizardError(error) };
  }
  return { error: null, data: result };
}

export async function loadMoreImports({
  filters = {},
  offset,
}: LoadMoreImportsInput): Promise<LoadMoreImportsResult> {
  try {
    const normalizedOffset = normalizeOffset(offset);
    const imports = await getImports(parseImportFilters(filters), {
      limit: IMPORT_LIST_LIMIT,
      offset: normalizedOffset,
    });

    return {
      imports,
      hasMore: imports.length === IMPORT_LIST_LIMIT,
      error: null,
    };
  } catch {
    return {
      imports: [],
      hasMore: false,
      error: "Non è stato possibile caricare altre importazioni. Riprova.",
    };
  }
}

const SAFE_ANALYZE_LIFECYCLE_MSG =
  "Analisi non consentita per questo file nel suo stato attuale.";
const SAFE_IMPORT_LIFECYCLE_MSG =
  "Importazione non consentita per questo file nel suo stato attuale.";

function mapAnalyzeError(error: unknown): string {
  if (error instanceof Error && error.message === SAFE_ANALYZE_LIFECYCLE_MSG) {
    return SAFE_ANALYZE_LIFECYCLE_MSG;
  }
  return "Impossibile analizzare il file. Riprova tra qualche secondo.";
}

function mapConfirmError(error: unknown): string {
  if (error instanceof Error && error.message === SAFE_IMPORT_LIFECYCLE_MSG) {
    return SAFE_IMPORT_LIFECYCLE_MSG;
  }
  return "Impossibile importare il file. Riprova tra qualche secondo.";
}

export async function analyzeImportAction(
  formData: FormData,
): Promise<ImportActionState<ImportAnalysisResult>> {
  const raw = {
    fileId: formData.get("fileId"),
    selectedFormatVersionId: optionalPositiveInteger(
      formData,
      "selectedFormatVersionId",
    ),
  };

  const parsed = AnalyzeImportSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidImportError();
  }

  const { userId } = await verifySession();

  try {
    const result = await analyzeFile({
      userId,
      fileId: parsed.data.fileId,
      selectedFormatVersionId: parsed.data.selectedFormatVersionId,
    });

    if (result.errors.length > 0) {
      return {
        error:
          result.errors[0] ??
          "Impossibile analizzare il file. Riprova tra qualche secondo.",
        data: result,
      };
    }

    return { error: null, data: result };
  } catch (error) {
    return { error: mapAnalyzeError(error) };
  }
}

export async function confirmImportAction(
  formData: FormData,
): Promise<ImportActionState<ImportFileResult>> {
  const raw = {
    fileId: formData.get("fileId"),
    selectedFormatVersionId: optionalPositiveInteger(
      formData,
      "selectedFormatVersionId",
    ),
    overrideWarnings: formData.get("overrideWarnings") === "true",
  };

  const parsed = ImportFileSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidImportError();
  }

  const { userId, subscriptionPlan } = await verifySession();

  try {
    const result = await importFile({
      userId,
      fileId: parsed.data.fileId,
      selectedFormatVersionId: parsed.data.selectedFormatVersionId,
      overrideWarnings: parsed.data.overrideWarnings,
      subscriptionPlan,
    });

    revalidatePath(APP_ROUTES.import);
    revalidatePath(APP_ROUTES.expenses);

    return { error: null, data: result };
  } catch (error) {
    return { error: mapConfirmError(error) };
  }
}

export async function completeOnboardingPrivateImportAction(
  formData: FormData,
): Promise<ImportActionState<CompleteOnboardingPrivateImportResult>> {
  const raw = {
    fileId: formData.get("fileId"),
    selectedFormatVersionId: optionalPositiveInteger(
      formData,
      "selectedFormatVersionId",
    ),
  };

  const parsed = AnalyzeImportSchema.safeParse(raw);
  if (!parsed.success || parsed.data.selectedFormatVersionId === undefined) {
    return invalidImportError();
  }

  const { userId, subscriptionPlan } = await verifySession();
  const { fileId, selectedFormatVersionId } = parsed.data;

  let analysis: ImportAnalysisResult;
  try {
    analysis = await analyzeFile({
      userId,
      fileId,
      selectedFormatVersionId,
    });
  } catch (error) {
    return { error: mapAnalyzeError(error) };
  }

  if (analysis.errors.length > 0) {
    return {
      error:
        analysis.errors[0] ??
        "Impossibile analizzare il file. Riprova tra qualche secondo.",
    };
  }

  try {
    const result = await importFile({
      userId,
      fileId,
      selectedFormatVersionId,
      overrideWarnings: true,
      subscriptionPlan,
    });

    revalidatePath(APP_ROUTES.import);
    revalidatePath(APP_ROUTES.expenses);
    revalidatePath(APP_ROUTES.onboarding);

    return {
      error: null,
      data: {
        ...result,
        nextRoute: ONBOARDING_AFTER_PRIVATE_PLATFORM_CREATION_ROUTE,
      },
    };
  } catch (error) {
    return { error: mapConfirmError(error) };
  }
}

export async function previewImportDeletionAction(
  formData: FormData,
): Promise<ImportActionState<ImportDeletePreview>> {
  const parsed = DeleteImportSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
  });

  if (!parsed.success) {
    return { error: "Importazione non valida." };
  }

  let userId: string;

  try {
    const session = await verifySession();
    userId = session.userId;
  } catch {
    return {
      error:
        "Sessione scaduta. Accedi di nuovo per eliminare questa importazione.",
    };
  }

  try {
    const preview = await getImportDeletePreview({
      userId,
      fileId: parsed.data.fileId,
    });

    return { error: null, data: preview };
  } catch (error) {
    return { error: mapImportDeleteError(error, "preview") };
  }
}

export async function deleteImportAction(
  _prev: ImportActionState<ImportDeleteResult>,
  formData: FormData,
): Promise<ImportActionState<ImportDeleteResult>> {
  const parsed = DeleteImportSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
  });

  if (!parsed.success) {
    return { error: "Importazione non valida." };
  }

  let userId: string;

  try {
    const session = await verifySession();
    userId = session.userId;
  } catch {
    return {
      error:
        "Sessione scaduta. Accedi di nuovo per eliminare questa importazione.",
    };
  }

  try {
    const result = await deleteImportService({
      userId,
      fileId: parsed.data.fileId,
    });

    try {
      revalidateImportDeletionSurfaces();
    } catch {
      return {
        error:
          "Importazione eliminata, ma non è stato possibile aggiornare le viste. Ricarica la pagina.",
        data: result,
      };
    }

    return { error: null, data: result };
  } catch (error) {
    return { error: mapImportDeleteError(error, "delete") };
  }
}

const STALE_DELETABLE_STATUSES = [
  "pending_upload",
  "uploaded",
  "analyzed",
  "failed",
] as const;
type StaleDeletableStatus = (typeof STALE_DELETABLE_STATUSES)[number];

function isStaleDeletable(status: string): status is StaleDeletableStatus {
  return (STALE_DELETABLE_STATUSES as readonly string[]).includes(status);
}

export async function deleteStaleFileAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const parsed = DeleteImportSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
  });

  if (!parsed.success) {
    return { error: "Importazione non valida." };
  }

  let userId: string;

  try {
    const session = await verifySession();
    userId = session.userId;
  } catch {
    return {
      error:
        "Sessione scaduta. Accedi di nuovo per eliminare questa importazione.",
    };
  }

  const fileRow = await getFileForUser({ userId, fileId: parsed.data.fileId });

  if (!fileRow) {
    return { error: "Importazione non trovata o accesso negato." };
  }

  if (!isStaleDeletable(fileRow.status)) {
    return {
      error: "Questa importazione non può essere eliminata in questo stato.",
    };
  }

  try {
    await db
      .delete(fileTable)
      .where(
        and(eq(fileTable.id, parsed.data.fileId), eq(fileTable.userId, userId)),
      );

    revalidatePath(APP_ROUTES.import);
    return { error: null };
  } catch {
    return {
      error:
        "Impossibile eliminare l'importazione. Riprova tra qualche secondo.",
    };
  }
}

/**
 * On-demand per-row re-check action (TRIG-02).
 * Resolves userId server-side via verifySession — never from client input.
 * Resolves platformId via ownership-guarded DAL call — IDOR guard (T-54-08, T-54-09).
 * Delegates all discovery logic to discoverRegexCandidates — no second detector path.
 * Read-only: no revalidatePath.
 */
export async function recheckRegexAction(
  formData: FormData,
): Promise<ImportActionState<{ candidatesCount: number; singleCount: number; platformId: number }>> {
  // Validate client-supplied fileId (not trusted for ownership — only for lookup)
  const fileId = formData.get("fileId");
  if (!fileId || typeof fileId !== "string" || fileId.trim() === "") {
    return { error: "File di import non valido." };
  }

  // Resolve userId server-side — never accept from client (T-54-09)
  const { userId } = await verifySession();

  // Ownership guard: resolve platformId only for files owned by this user (T-54-08)
  const platformId = await getPlatformIdForUserFile({ userId, fileId });
  if (platformId == null) {
    return { error: "Impossibile determinare la piattaforma per questo file." };
  }

  // Call the unified discovery service — no business logic in the action (layer rule)
  try {
    const result = await discoverRegexCandidates({ userId, scope: { platformId } });
    return {
      error: null,
      data: {
        candidatesCount: result.candidates.length,
        singleCount: result.singleCategorizationSuggestions.length,
        platformId: result.platformId,
      },
    };
  } catch {
    return {
      error:
        "Impossibile eseguire il riconoscimento pattern. Riprova tra qualche secondo.",
    };
  }
}

export async function updateImportDisplayNameAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const parsed = UpdateImportDisplayNameSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
    displayName: formData.get("displayName") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let userId: string;

  try {
    const session = await verifySession();
    userId = session.userId;
  } catch {
    return {
      error:
        "Sessione scaduta. Accedi di nuovo per rinominare questa importazione.",
    };
  }

  try {
    const updated = await updateImportDisplayName(db, {
      userId,
      fileId: parsed.data.fileId,
      displayName: parsed.data.displayName,
    });

    if (!updated) {
      return { error: "Importazione non trovata o accesso negato." };
    }

    revalidatePath(APP_ROUTES.import);

    return { error: null };
  } catch {
    return { error: "Si è verificato un errore. Riprova tra qualche secondo." };
  }
}
