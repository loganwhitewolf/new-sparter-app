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

  it("accepts trimmed valid filters from plain Next searchParams", () => {
    const parsed = parseTransactionFilters({
      from: " 2025-01-02 ",
      to: "2025-01-31",
      platform: " revolut-bank ",
      sort: "amount",
      dir: "asc",
    })

    expect(parsed).toEqual({
      from: "2025-01-02",
      to: "2025-01-31",
      platform: "revolut-bank",
      sort: "amount",
      dir: "asc",
      fromDate: new Date("2025-01-02T00:00:00.000Z"),
      toDate: new Date("2025-01-31T23:59:59.999Z"),
    })
  })

  it("uses the first array item and ignores the field when that value is invalid", () => {
    const parsed = parseTransactionFilters({
      from: ["not-a-date", "2025-01-02"],
      to: ["2025-02-03", "not-a-date"],
      platform: [" bad slug ", "valid-slug"],
      sort: ["unknown", "amount"],
      dir: ["sideways", "asc"],
    })

    expect(parsed).toEqual({
      to: "2025-02-03",
      sort: "occurredAt",
      dir: "desc",
      toDate: new Date("2025-02-03T23:59:59.999Z"),
    })
  })

  it("falls back safely for unknown sort and direction values", () => {
    expect(
      parseTransactionFilters({
        sort: "description",
        dir: "oldest-first",
      }),
    ).toMatchObject({
      sort: "occurredAt",
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
