# FlowNature classification lives on Subcategory, not Category

The `nature` enum field lives on `sub_category`, not on `category`.

## Considered Options

- **Category-level:** simpler — fewer rows to configure, one decision per category. Fails because several categories contain subcategories of genuinely different natures: `abbonamenti` contains `servizi telefonici e internet` (essential) and `streaming video` (discretionary); `assicurazioni` contains `auto` (essential) and `viaggio` (discretionary); `trasporti` contains `mezzi pubblici` (essential) and `taxi e ride sharing` (discretionary). A single category-level nature would force incorrect classification for a significant fraction of subcategories.

- **Subcategory-level (chosen):** precise — ~120 system subcategories receive a default nature in the seed. Users can override per-subcategory from settings. User-created subcategories set their nature on creation (required field with a preselected default to reduce friction).

## Consequences

- `sub_category` gets a nullable `nature` column. Nullable to support graceful migration: existing user subcategories start with `null` and appear as a "non classificato" segment in the chart until classified.
- System subcategories are assigned a nature in the seed migration; no user action required for a useful out-of-the-box chart.
- Chart queries must join through `sub_category` to reach `nature`; grouping is by nature value, not by category type.
- The "non classificato" segment in the chart is a first-class signal, not an error state.
