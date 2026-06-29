# Platform è identità globale moderata; l'ownership privata vive sull'Import Format

## Status

accepted (estende [ADR 0013](./0013-import-format-owns-parsing-contract.md) sull'aspetto ownership, lasciato implicito)

## Contesto

ADR 0013 stabilì che `platform` è pura identità del fornitore e `import_format_version` possiede il contratto di parsing, ma non disse **chi possiede cosa**. Nella pratica:

- Il wizard, quando la detection per `headerSignature` falliva, creava **sempre una platform nuova** — mai un nuovo Import Format sotto una platform esistente. Risultato: più "Fineco" duplicate (una per ogni utente con un tracciato non standard), quando ADR 0013 aveva progettato proprio i format-version multipli per evitarlo.
- `accessibleWhere` accoppiava **formato privato ⇒ platform privata** (`platform.visibility = PRIVATE` richiesto per vedere un formato privato). Un formato privato appeso a una platform globale non sarebbe stato nemmeno visibile — il vincolo nella query *costringeva* il wizard a duplicare la platform.
- Il seed hardcodava `platformId: 8` per Trade Republic; quell'id collideva con la platform serial già creata da un utente, e `onConflictDoNothing` faceva saltare il seed di TR silenziosamente, lasciando l'import format puntato alla platform sbagliata.

Una "platform privata posseduta da un utente" è una contraddizione: un'identità-fornitore è per natura condivisa.

## Decisione

- **Platform non è mai posseduta.** Ha un ciclo di review governato da `reviewStatus`: una platform proposta da un utente nasce `pending` ed è visibile **solo al proponente**; approvata diventa `approved` e **condivisa con tutti**. Schema: drop `platform.visibility`, rename `platform.ownerUserId` → `platform.proposedByUserId` (provenienza, non proprietà), usa `reviewStatus`.
- **L'ownership privata vive solo sull'Import Format** (`importFormatVersion.ownerUserId`), che può essere privato **anche su una platform globale/approvata**. `accessibleWhere` si allenta a "formato privato visibile al proprietario su platform qualsiasi", disaccoppiando formato-privato da platform-privata.
- **Wizard:** quando la detection fallisce, prima proporre una **platform esistente** a cui appendere un nuovo Import Format privato; solo se nessuna combacia, creare una platform nuova (che nasce `pending`).
- **Seed linkato per slug, non per id.** Le platform seedate non hanno più `id:` esplicito (serial assegna; conflict su slug unique); gli import format nel seed referenziano `platformSlug` e `seed.ts` risolve slug→id a runtime. La **FK a runtime resta `platformId`** (surrogate int, join calda) — lo slug è solo la chiave di linkage nel seed.

## Conseguenze

- Elimina la collisione di id nel seed e i duplicati di platform ("2-3 Fineco" → una Fineco condivisa con format-version multipli, di cui alcuni privati).
- L'identità Platform resta una dimensione analitica reale (filtro/display/sort per `platform.slug`/`platform.name` in expenses/transactions/imports): ogni banca distinta mantiene la sua riga e il suo nome.
- **UI operatore di approvazione rimandata.** Per single-user una platform `pending` è già visibile e funzionale al proponente; lo step "approva → condividi" non scatta finché non c'è un secondo utente. Deferred, non costruito ora.
- Il caso comune (banca nota, tracciato rielaborato — es. Fineco esportato e rimaneggiato in Excel) non tocca la macchina del review: è un Import Format privato sotto una platform `approved` esistente.
- Voce di glossario `DescriptionStripPattern` da correggere ("configurata per Platform" → su `importFormatVersion` da ADR 0013).
