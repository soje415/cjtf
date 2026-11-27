/** The API returns at most 1000 rows per request; read a whole result in pages.
 *  The query passed in must have a stable order. */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const SIZE = 1000
  const all: T[] = []
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if ((data?.length ?? 0) < SIZE) return all
  }
}
