import { describe, expect, it } from "vitest"

import {
  UpdateTransactionCustomTitleSchema,
  getInclusiveToDate,
  parseTransactionFilters,
} from "../transactions"

describe("parseTransactionFilters", () => {
  it("returns deterministic defaults for empty Next searchParams", () => {
    expect(parseTransactionFilters({})).toEqual({
      sort: "occurredAt",
      dir: "desc",
    })
  })

  it("accepts trimmed valid filters from plain Next searchParams; legacy from/to are ignored (Wave 5 migration)", () => {
    const parsed = parseTransactionFilters({
      // Wave 5: from/to params are no longer parsed — old links degrade to default view.
      from: " 2025-01-02 ",
      to: "2025-01-31",
      platform: " revolut-bank ",
      category: " food-and-drinks ",
      subCategory: "42",
      sort: "amount",
      dir: "asc",
    })

    expect(parsed).toEqual({
      platform: "revolut-bank",
      categorySlug: "food-and-drinks",
      subCategoryId: 42,
      sort: "amount",
      dir: "asc",
    })
  })

  it("uses the first array item and ignores the field when that value is invalid; legacy from/to are ignored (Wave 5 migration)", () => {
    const parsed = parseTransactionFilters({
      // Wave 5: from/to params are no longer parsed — old links degrade to default view.
      from: ["not-a-date", "2025-01-02"],
      to: ["2025-02-03", "not-a-date"],
      platform: [" bad slug ", "valid-slug"],
      category: [" bad slug ", "valid-slug"],
      subCategory: ["0", "42"],
      sort: ["unknown", "amount"],
      dir: ["sideways", "asc"],
    })

    expect(parsed).toEqual({
      sort: "occurredAt",
      dir: "desc",
    })
  })


  it("ignores invalid category and subcategory filters", () => {
    expect(
      parseTransactionFilters({
        category: "Bad Slug!",
        subCategory: "not-a-number",
      }),
    ).toEqual({
      sort: "occurredAt",
      dir: "desc",
    })

    expect(parseTransactionFilters({ subCategory: "-1" }).subCategoryId).toBeUndefined()
    expect(parseTransactionFilters({ subCategory: "1.5" }).subCategoryId).toBeUndefined()
  })

  it("falls back safely for unknown sort and direction values", () => {
    expect(
      parseTransactionFilters({
        sort: "unknown",
        dir: "oldest-first",
      }),
    ).toMatchObject({
      sort: "occurredAt",
      dir: "desc",
    })
  })

  it("accepts description, category, and platform sort", () => {
    expect(
      parseTransactionFilters({
        sort: "description",
        dir: "asc",
      }),
    ).toMatchObject({
      sort: "description",
      dir: "asc",
    })
    expect(
      parseTransactionFilters({
        sort: "category",
        dir: "asc",
      }),
    ).toMatchObject({
      sort: "category",
      dir: "asc",
    })
    expect(
      parseTransactionFilters({
        sort: "platform",
        dir: "desc",
      }),
    ).toMatchObject({
      sort: "platform",
      dir: "desc",
    })
  })

  it("cleans up empty strings instead of returning blank filters", () => {
    expect(
      parseTransactionFilters({
        from: "   ",
        to: "",
        platform: "  ",
        sort: " ",
        dir: " ",
      }),
    ).toEqual({
      sort: "occurredAt",
      dir: "desc",
    })
  })

  it("ignores malformed dates without throwing", () => {
    expect(() =>
      parseTransactionFilters({
        from: "2025-02-30",
        to: "2025-13-01",
      }),
    ).not.toThrow()

    expect(
      parseTransactionFilters({
        from: "2025-02-30",
        to: "2025-13-01",
      }),
    ).toEqual({
      sort: "occurredAt",
      dir: "desc",
    })
  })

  it("accepts a valid UUID importId and includes it in parsed filters", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    const parsed = parseTransactionFilters({ importId: uuid })

    expect(parsed.importId).toBe(uuid)
  })

  it("rejects non-UUID importId values and omits them from parsed filters", () => {
    expect(parseTransactionFilters({ importId: "not-a-uuid" }).importId).toBeUndefined()
    expect(parseTransactionFilters({ importId: "123" }).importId).toBeUndefined()
    expect(parseTransactionFilters({ importId: "" }).importId).toBeUndefined()
    expect(parseTransactionFilters({ importId: "   " }).importId).toBeUndefined()
    expect(
      parseTransactionFilters({ importId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }).importId,
    ).toBeUndefined()
  })

  it("uses the first array value for importId and rejects invalid first items", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"

    expect(
      parseTransactionFilters({ importId: [uuid, "not-a-uuid"] }).importId,
    ).toBe(uuid)
    expect(
      parseTransactionFilters({ importId: ["not-a-uuid", uuid] }).importId,
    ).toBeUndefined()
  })

  it("composes importId with platform and sort filters; legacy from/to are ignored (Wave 5 migration)", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    const parsed = parseTransactionFilters({
      importId: uuid,
      // Wave 5: legacy from/to params are no longer parsed into active filters.
      // Old shared links silently degrade to the default view (total parsing).
      from: "2025-01-01",
      to: "2025-01-31",
      platform: "revolut",
      sort: "amount",
      dir: "asc",
    })

    expect(parsed.importId).toBe(uuid)
    expect(parsed.fromDate).toBeUndefined()
    expect(parsed.toDate).toBeUndefined()
    expect(parsed.platform).toBe("revolut")
    expect(parsed.sort).toBe("amount")
    expect(parsed.dir).toBe("asc")
  })
})

describe("UpdateTransactionCustomTitleSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

  it("passes a valid string title", () => {
    const result = UpdateTransactionCustomTitleSchema.safeParse({
      id: VALID_UUID,
      customTitle: "My custom title",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.customTitle).toBe("My custom title")
    }
  })

  it("coerces empty string to null", () => {
    const result = UpdateTransactionCustomTitleSchema.safeParse({
      id: VALID_UUID,
      customTitle: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.customTitle).toBeNull()
    }
  })

  it("passes null through as null", () => {
    const result = UpdateTransactionCustomTitleSchema.safeParse({
      id: VALID_UUID,
      customTitle: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.customTitle).toBeNull()
    }
  })

  it("fails for string longer than 255 characters", () => {
    const result = UpdateTransactionCustomTitleSchema.safeParse({
      id: VALID_UUID,
      customTitle: "a".repeat(256),
    })
    expect(result.success).toBe(false)
  })

  it("fails for invalid UUID", () => {
    const result = UpdateTransactionCustomTitleSchema.safeParse({
      id: "not-a-uuid",
      customTitle: "title",
    })
    expect(result.success).toBe(false)
  })
})

describe("getInclusiveToDate", () => {
  it("converts a valid YYYY-MM-DD value to the end of that UTC day", () => {
    expect(getInclusiveToDate("2025-05-06")).toEqual(
      new Date("2025-05-06T23:59:59.999Z"),
    )
  })

  it("returns undefined for malformed dates", () => {
    expect(getInclusiveToDate("2025-02-29")).toBeUndefined()
    expect(getInclusiveToDate("not-a-date")).toBeUndefined()
  })
})
