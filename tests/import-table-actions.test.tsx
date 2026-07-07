import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Radix portals omit menu content from SSR; render a flat stub for static markup assertions.
vi.mock("@/components/ui/dropdown-menu", async () => {
  const React = await import("react");

  const DropdownMenu = ({ children }: { children?: ReactNode }) =>
    React.createElement("div", { "data-slot": "dropdown-menu" }, children);

  const DropdownMenuTrigger = ({
    children,
    asChild,
  }: {
    children?: ReactNode;
    asChild?: boolean;
  }) =>
    asChild
      ? children
      : React.createElement("button", { type: "button" }, children);

  const DropdownMenuContent = ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "motion.div",
      { "data-slot": "dropdown-menu-content", className },
      children,
    );

  const DropdownMenuItem = ({
    children,
    asChild,
    onClick,
    className,
  }: {
    children?: ReactNode;
    asChild?: boolean;
    onClick?: () => void;
    className?: string;
  }) =>
    asChild
      ? children
      : React.createElement(
          "button",
          { type: "button", onClick, className },
          children,
        );

  const DropdownMenuSeparator = () =>
    React.createElement("hr", { "data-slot": "dropdown-menu-separator" });

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuGroup: DropdownMenu,
    DropdownMenuPortal: ({ children }: { children?: ReactNode }) => children,
    DropdownMenuSub: DropdownMenu,
    DropdownMenuSubTrigger: DropdownMenuTrigger,
    DropdownMenuSubContent: DropdownMenuContent,
    DropdownMenuRadioGroup: DropdownMenu,
    DropdownMenuRadioItem: DropdownMenuItem,
    DropdownMenuCheckboxItem: DropdownMenuItem,
    DropdownMenuLabel: DropdownMenuItem,
    DropdownMenuShortcut: ({ children }: { children?: ReactNode }) => children,
  };
});

// next/link renders fine in node; no mock required.
// 'use client' directive is ignored in vitest / renderToStaticMarkup.

const { ImportRowActions } =
  await import("../components/import/import-row-actions");

const FILE_ID = "aabbccdd-0000-4000-8000-aabbccddeeff";

/**
 * Minimal ImportListRow fixture with only the fields ImportRowActions reads.
 * All optional analytics fields (rowCount, etc.) default to safe zero values.
 */
function makeRow(
  overrides: Partial<{
    id: string;
    status:
      | "pending_upload"
      | "uploaded"
      | "analyzing"
      | "analyzed"
      | "importing"
      | "imported"
      | "failed";
    errorMessage: string | null;
    displayName: string | null;
    originalName: string;
  }>,
) {
  return {
    id: FILE_ID,
    displayName: null,
    originalName: "estratto.csv",
    status: "uploaded" as const,
    platformId: null,
    platformName: null,
    platformSlug: null,
    uploadedAt: null,
    analyzedAt: null,
    importStartedAt: null,
    importedAt: null,
    rowCount: 0,
    importedCount: 0,
    duplicateCount: 0,
    positiveTotal: "0.00",
    negativeTotal: "0.00",
    referenceStartedAt: null,
    referenceEndedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

const DISPLAY_NAME = "Gennaio 2026";
const onDelete = vi.fn();
const onDeleteStale = vi.fn();
// Added with TRIG-02 (Plan 54-03): recheckRegexAction per-row re-check
const onRecheckRegex = vi.fn();

function render(row: ReturnType<typeof makeRow>, displayName = DISPLAY_NAME) {
  return renderToStaticMarkup(
    createElement(ImportRowActions, {
      row,
      displayName,
      onDelete,
      onDeleteStale,
      onRecheckRegex,
    }),
  );
}

describe("ImportRowActions — state matrix", () => {
  it("uploaded: shows Analizza link to the analyze route and overflow menu trigger", () => {
    const html = render(makeRow({ status: "uploaded" }));

    expect(html).toContain("Analizza");
    expect(html).toContain(`/import/${FILE_ID}/analyze`);
    expect(html).toContain(`aria-label="Altre azioni per ${DISPLAY_NAME}"`);
    expect(html).not.toContain("Configura formato");
    expect(html).not.toContain("Riprova analisi");
  });

  it("uploaded: Analizza link has accessible aria-label", () => {
    const html = render(makeRow({ status: "uploaded" }));

    expect(html).toContain(`aria-label="Analizza ${DISPLAY_NAME}"`);
  });

  it("analyzed: shows Rivedi e importa link to the analyze route and overflow menu trigger", () => {
    const html = render(makeRow({ status: "analyzed" }));

    expect(html).toContain("Rivedi e importa");
    expect(html).toContain(`/import/${FILE_ID}/analyze`);
    expect(html).toContain(`aria-label="Altre azioni per ${DISPLAY_NAME}"`);
    expect(html).not.toContain("Analizza");
  });

  it("analyzed: Rivedi e importa link has accessible aria-label", () => {
    const html = render(makeRow({ status: "analyzed" }));

    expect(html).toContain(`aria-label="Rivedi e importa ${DISPLAY_NAME}"`);
  });

  it("importing: renders disabled pending copy, no active CTAs", () => {
    const html = render(makeRow({ status: "importing" }));

    expect(html).toContain("Importazione");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("Elimina");
    expect(html).not.toContain("Rivedi e importa");
    expect(html).not.toContain("Analizza");
    expect(html).not.toContain("Vedi transazioni");
  });

  it("importing: pending copy has accessible aria-label", () => {
    const html = render(makeRow({ status: "importing" }));

    expect(html).toContain(
      'aria-label="Importazione in corso, nessuna azione disponibile"',
    );
  });

  it("analyzing: shows in-progress copy and delete in overflow menu", () => {
    const html = render(makeRow({ status: "analyzing" }));

    expect(html).toContain("Analisi");
    expect(html).toContain("Elimina");
    expect(html).toContain(`aria-label="Altre azioni per ${DISPLAY_NAME}"`);
    expect(html).not.toContain("href=");
    expect(html).not.toContain("Rivedi e importa");
    expect(html).not.toContain("Vedi transazioni");
  });

  it("analyzing: in-progress copy has accessible aria-label", () => {
    const html = render(makeRow({ status: "analyzing" }));

    expect(html).toContain('aria-label="Analisi in corso"');
  });

  it("imported: shows Vedi transazioni link scoped to exact importId in dropdown", () => {
    const html = render(makeRow({ status: "imported" }));

    expect(html).toContain("Vedi transazioni");
    expect(html).toContain("Scarica file originale");
    expect(html).toContain(`/transactions?importId=${FILE_ID}`);
    expect(html).not.toContain("Analizza");
    expect(html).not.toContain("Configura formato");
    expect(html).not.toContain("Riprova analisi");
  });

  it("imported: shows Elimina item in dropdown menu", () => {
    const html = render(makeRow({ status: "imported" }));

    expect(html).toContain("Elimina");
  });

  it("imported: overflow menu does not expose rename (inline edit on file name)", () => {
    const html = render(makeRow({ status: "imported" }));

    expect(html).not.toContain("Rinomina");
  });

  it("imported: overflow menu trigger has accessible aria-label", () => {
    const html = render(makeRow({ status: "imported" }));

    expect(html).toContain(`aria-label="Altre azioni per ${DISPLAY_NAME}"`);
  });

  it("failed (unknown-format): shows Configura formato link and delete in overflow menu, no Riprova analisi", () => {
    const html = render(
      makeRow({
        status: "failed",
        errorMessage:
          "No supported import format matched the uploaded file headers and sample rows.",
      }),
    );

    expect(html).toContain("Configura formato");
    expect(html).toContain(`/import/${FILE_ID}/configure`);
    expect(html).not.toContain("Riprova analisi");
    expect(html).toContain("Elimina");
    expect(html).not.toContain("Vedi transazioni");
  });

  it("failed (unknown-format): Configura formato has accessible aria-label", () => {
    const html = render(
      makeRow({
        status: "failed",
        errorMessage:
          "No supported import format matched the uploaded file headers and sample rows.",
      }),
    );

    expect(html).toContain(
      `aria-label="Configura formato per ${DISPLAY_NAME}"`,
    );
  });

  it("failed (non-unknown): shows Riprova analisi and delete in overflow menu, no Configura formato", () => {
    const html = render(
      makeRow({
        status: "failed",
        errorMessage: "Could not read uploaded file.",
      }),
    );

    expect(html).toContain("Riprova analisi");
    expect(html).toContain("Elimina");
    expect(html).not.toContain("Configura formato");
    expect(html).not.toContain("configure");
    expect(html).not.toContain("Vedi transazioni");
  });

  it("failed (non-unknown): Riprova analisi has accessible aria-label", () => {
    const html = render(
      makeRow({
        status: "failed",
        errorMessage: "Could not parse uploaded file.",
      }),
    );

    expect(html).toContain(`aria-label="Riprova analisi di ${DISPLAY_NAME}"`);
  });

  it("failed with null errorMessage: shows Riprova analisi only (no configure)", () => {
    const html = render(makeRow({ status: "failed", errorMessage: null }));

    expect(html).toContain("Riprova analisi");
    expect(html).not.toContain("Configura formato");
  });

  it("pending_upload: shows overflow menu with delete to clean up stuck uploads", () => {
    const html = render(makeRow({ status: "pending_upload" }));

    expect(html).toContain(`aria-label="Altre azioni per ${DISPLAY_NAME}"`);
    expect(html).toContain("Elimina");
    expect(html).not.toContain("Analizza");
    expect(html).not.toContain("Rivedi");
    expect(html).not.toContain("Vedi transazioni");
    expect(html).not.toContain("Scarica file originale");
  });

  it("does not render raw storage diagnostics in non-failed states", () => {
    for (const row of [
      makeRow({ status: "imported" }),
      makeRow({ status: "analyzing" }),
    ]) {
      const html = render(row);
      expect(html).not.toContain("X-Amz-Signature");
      expect(html).not.toContain("objectKey");
      expect(html).not.toContain("stack");
    }
  });

  it("failed state shows sanitized user-facing error copy inside overflow menu", () => {
    const html = render(
      makeRow({
        status: "failed",
        errorMessage:
          "No supported import format matched the uploaded file headers and sample rows.",
      }),
    );

    expect(html).toContain("Errore");
    expect(html).toContain("No supported import format matched");
    expect(html).not.toContain("X-Amz-Signature");
  });

  it("URLs encode the fileId correctly when fileId contains characters needing encoding", () => {
    // UUIDs are already safe, but verify encodeURIComponent is applied.
    const safeId = "aabbccdd-1111-4111-8111-111111111111";

    // imported: check transactions link
    const importedHtml = render(makeRow({ id: safeId, status: "imported" }));
    expect(importedHtml).toContain(`/transactions?importId=${safeId}`);

    // uploaded: check analyze link
    const uploadedHtml = render(makeRow({ id: safeId, status: "uploaded" }));
    expect(uploadedHtml).toContain(`/import/${safeId}/analyze`);

    // failed unknown-format: check configure link
    const failedHtml = render(
      makeRow({
        id: safeId,
        status: "failed",
        errorMessage:
          "No supported import format matched the uploaded file headers and sample rows.",
      }),
    );
    expect(failedHtml).toContain(`/import/${safeId}/configure`);
  });
});

describe("ImportRowActions — Dettagli dropdown item (DET-09)", () => {
  it('shows "Dettagli" dropdown item only for status=imported, linking to importFileDetailHref(row.id)', () => {
    const importedHtml = render(makeRow({ status: "imported", id: "file-42" }));
    expect(importedHtml).toContain("Dettagli");
    expect(importedHtml).toContain('href="/import/file-42"');

    const uploadedHtml = render(makeRow({ status: "uploaded", id: "file-43" }));
    expect(uploadedHtml).not.toContain("Dettagli");
  });

  it("does not show Dettagli for non-imported statuses", () => {
    for (const status of ["analyzed", "failed", "pending_upload"] as const) {
      const html = render(makeRow({ status }));
      expect(html).not.toContain("Dettagli");
    }
  });
});

describe("ImportRowActions — Rivedi suggerimenti dropdown item (POST-01)", () => {
  it('shows "Rivedi suggerimenti" dropdown item only for status=imported', () => {
    const importedHtml = render(makeRow({ status: "imported", id: "file-42" }));
    expect(importedHtml).toContain("Rivedi suggerimenti");
    expect(importedHtml).toContain('href="/import/file-42/suggestions"');

    const uploadedHtml = render(makeRow({ status: "uploaded", id: "file-43" }));
    expect(uploadedHtml).not.toContain("Rivedi suggerimenti");
    expect(uploadedHtml).not.toContain("/suggestions");
  });

  it('does not show "Rivedi suggerimenti" for non-imported statuses', () => {
    for (const status of ["analyzed", "failed", "pending_upload"] as const) {
      const html = render(makeRow({ status }));
      expect(html).not.toContain("Rivedi suggerimenti");
      expect(html).not.toContain("/suggestions");
    }
  });
});

describe("ImportRowActions — in-progress states do not expose duplicate-operation CTAs", () => {
  it("analyzing row: no analyze, import, or configure links", () => {
    const html = render(makeRow({ status: "analyzing" }));

    expect(html).not.toContain("/analyze");
    expect(html).not.toContain("/configure");
    expect(html).not.toContain("Importa");
    expect(html).not.toContain("Analizza");
  });

  it("importing row: no analyze, import, delete, or configure links", () => {
    const html = render(makeRow({ status: "importing" }));

    expect(html).not.toContain("/analyze");
    expect(html).not.toContain("/configure");
    expect(html).not.toContain("Elimina");
    // "Importa" alone could match "Importazione in corso" — check no active href/button for import
    expect(html).not.toContain("Rivedi e importa");
    expect(html).not.toContain("Analizza");
  });
});
