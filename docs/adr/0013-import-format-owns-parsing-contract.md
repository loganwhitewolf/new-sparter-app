# Il contratto di parsing è posseduto da `import_format_version`, non da `platform`

## Status

accepted

## Contesto

Storicamente la tabella `platform` mescolava due responsabilità: l'**identità** del fornitore (nome, slug, paese, visibilità) e il **contratto di parsing** orientato al CSV (`delimiter`, `*Column`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `descriptionStripPattern`). La tabella `import_format_version` esisteva già, versionata (`unique(platformId, version)`), ma conteneva solo `headerSignature` + `notes`.

Conseguenza: il versioning del formato **non funzionava davvero**. Il mapping delle colonne — la cosa che cambia tra una versione di tracciato e l'altra — viveva sul genitore non versionato (`platform`), quindi una Platform poteva avere un solo set di colonne. Un cambio di tracciato della banca non era esprimibile come `v2`.

## Decisione

L'intero contratto di parsing si sposta su `import_format_version`. `platform` resta **pura identità** del fornitore. Più `import_format_version` per Platform convivono per gestire cambi di tracciato e formati diversi (CSV/XLSX/PDF).

Il refactor è **behavior-preserving** e viene eseguito come fase a sé, **precedente** all'import PDF: i sei import CSV/XLSX esistenti devono produrre `transactionHash` identici prima e dopo. La migrazione delle righe già in produzione avviene via uno step `seed-extras` additivo.

## Conseguenze

- Sblocca il versioning reale dei tracciati per Platform.
- L'import PDF (ADR 0014) si innesta su un modello pulito: una Platform PDF è una `import_format_version` con colonne sintetiche, senza `delimiter` finto su `platform`.
- Tocca: schema (`platform`, `import_format_version`), detector (`scoreCandidate`), `normalizeTransactionRow`/`ImportPlatformConfig`, DAL di detection, `seed-data`/`seed.ts`/`seed-extras`, wizard formati e platform private utente.
- Apre la porta a un campo esplicito `sourceFormat`/`parserKind` (`csv|xlsx|pdf`) su `import_format_version` quando servirà.
