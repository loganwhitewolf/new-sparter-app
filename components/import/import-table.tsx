"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ImportDeleteDialog } from "@/components/import/import-delete-dialog";
import { ImportRenameDialog } from "@/components/import/import-rename-dialog";
import { ImportRowActions } from "@/components/import/import-row-actions";
import { ImportStaleDeleteDialog } from "@/components/import/import-stale-delete-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadMoreImports } from "@/lib/actions/import";
import type { ImportListRow } from "@/lib/dal/imports";
import type {
  ImportSearchParams,
  ParsedImportFilters,
} from "@/lib/validations/import";
import { cn } from "@/lib/utils";

type Props = {
  imports: ImportListRow[];
  filters: ParsedImportFilters;
  searchParams: ImportSearchParams;
  loadError?: boolean;
};

const PAGE_SIZE = 50;

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const statusLabels: Record<ImportListRow["status"], string> = {
  pending_upload: "In attesa",
  uploaded: "Caricato",
  analyzing: "In analisi",
  analyzed: "Analizzato",
  importing: "Importazione",
  imported: "Importato",
  failed: "Errore",
};

const statusClasses: Record<ImportListRow["status"], string> = {
  pending_upload: "bg-slate-100 text-slate-700",
  uploaded: "bg-sky-100 text-sky-700",
  analyzing: "bg-indigo-100 text-indigo-700",
  analyzed: "bg-violet-100 text-violet-700",
  importing: "bg-amber-100 text-amber-700",
  imported: "bg-emerald-100 text-emerald-700",
  failed: "bg-destructive/10 text-destructive",
};

function formatDate(date: Date | null) {
  return date ? dateFormatter.format(new Date(date)) : "—";
}

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start && !end) {
    return "—";
  }

  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  return start ? `Da ${formatDate(start)}` : `Fino a ${formatDate(end)}`;
}

function getImportDisplayName(row: ImportListRow) {
  return row.displayName?.trim() || row.originalName;
}

function hasActiveFilters(filters: ParsedImportFilters) {
  // Wave 5: legacy importedFrom/importedTo/referenceFrom/referenceTo no longer parsed.
  // Check only the canonical Wave 4+ filter keys.
  return Boolean(
    filters.q ||
    filters.platform ||
    filters.statusBucket ||
    (filters.months && filters.months.length > 0) ||
    filters.amountMin ||
    filters.amountMax,
  );
}

export function ImportTable({
  imports,
  filters,
  searchParams,
  loadError = false,
}: Props) {
  const [loadedImports, setLoadedImports] = useState(imports);
  const [hasMore, setHasMore] = useState(imports.length === PAGE_SIZE);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [renameImport, setRenameImport] = useState<ImportListRow | null>(null);
  const [deleteImport, setDeleteImport] = useState<ImportListRow | null>(null);
  const [staleDeleteImport, setStaleDeleteImport] =
    useState<ImportListRow | null>(null);
  const isLoadingMoreRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const filtered = hasActiveFilters(filters);

  const loadNextPage = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = await loadMoreImports({
        filters: searchParams,
        offset: loadedImports.length,
      });

      if (result.error) {
        setLoadMoreError(result.error);
        toast.error(result.error);
        return;
      }

      setLoadedImports((current) => [...current, ...result.imports]);
      setHasMore(result.hasMore);
    } catch {
      const safeError =
        "Non è stato possibile caricare altre importazioni. Riprova.";
      setLoadMoreError(safeError);
      toast.error(safeError);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, loadedImports.length, searchParams]);

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNextPage();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMore, loadNextPage]);

  function handleRenameSuccess(fileId: string, displayName: string | null) {
    setLoadedImports((current) =>
      current.map((row) => (row.id === fileId ? { ...row, displayName } : row)),
    );
  }

  function handleDeleteSuccess(fileId: string) {
    setLoadedImports((current) => current.filter((row) => row.id !== fileId));
    setDeleteImport(null);
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground" role="alert">
            Storico importazioni non disponibile
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Il caricamento dei file resta disponibile. Riprova più tardi per
            controllare stati e statistiche delle importazioni.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadedImports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">
            {filtered
              ? "Nessuna importazione corrisponde ai filtri"
              : "Nessuna importazione trovata"}
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {filtered
              ? "Modifica ricerca o intervalli data per ritrovare le importazioni disponibili."
              : "Carica un estratto conto per vedere qui stato, statistiche e intervallo di riferimento delle prossime importazioni."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableCaption className="sr-only">
            Storico importazioni con stato, piattaforma, date, statistiche,
            azioni di rinomina, eliminazione sicura e messaggi di errore sicuri.
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-secondary/70">
              <TableHead className="min-w-[16rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
                File
              </TableHead>
              <TableHead className="w-28 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Stato
              </TableHead>
              <TableHead className="min-w-[9rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Piattaforma
              </TableHead>
              <TableHead className="w-32 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Importato il
              </TableHead>
              <TableHead className="w-24 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Righe
              </TableHead>
              <TableHead className="min-w-[11rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Periodo
              </TableHead>
              <TableHead className="w-40">
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadedImports.map((row) => {
              const displayName = getImportDisplayName(row);

              return (
                <TableRow key={row.id} className="group hover:bg-muted/50">
                  <TableCell className="max-w-[20rem]">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span
                        className="truncate font-medium"
                        title={displayName}
                      >
                        {displayName}
                      </span>
                      {row.displayName ? (
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={row.originalName}
                        >
                          {row.originalName}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("border-0", statusClasses[row.status])}
                    >
                      {statusLabels[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.platformName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(row.importedAt ?? row.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    <div className="flex flex-col gap-0.5">
                      <span>{row.rowCount}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.importedCount} imp.
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateRange(
                      row.referenceStartedAt,
                      row.referenceEndedAt,
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ImportRowActions
                      row={row}
                      displayName={displayName}
                      onRename={setRenameImport}
                      onDelete={setDeleteImport}
                      onDeleteStale={setStaleDeleteImport}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div
          ref={loadMoreRef}
          className="flex min-h-14 items-center justify-center border-t px-4 py-3"
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoadingMore ? (
            <p className="text-sm text-muted-foreground">
              Caricamento altre importazioni…
            </p>
          ) : hasMore ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadNextPage}
            >
              Carica altre {PAGE_SIZE} importazioni
            </Button>
          ) : loadedImports.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Tutte le importazioni disponibili sono caricate.
            </p>
          ) : null}
        </div>
        {loadMoreError ? (
          <div className="border-t p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{loadMoreError}</AlertDescription>
            </Alert>
          </div>
        ) : null}
      </div>

      {renameImport ? (
        <ImportRenameDialog
          key={renameImport.id}
          importRow={renameImport}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setRenameImport(null);
            }
          }}
          onSuccess={handleRenameSuccess}
        />
      ) : null}

      {deleteImport ? (
        <ImportDeleteDialog
          key={deleteImport.id}
          importRow={deleteImport}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteImport(null);
            }
          }}
          onDeleted={handleDeleteSuccess}
        />
      ) : null}

      {staleDeleteImport ? (
        <ImportStaleDeleteDialog
          key={staleDeleteImport.id}
          importRow={staleDeleteImport}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setStaleDeleteImport(null);
            }
          }}
          onDeleted={handleDeleteSuccess}
        />
      ) : null}
    </>
  );
}
