export type ListResponse = Record<string, unknown>;
export type FetchPage = (offset: number, pageSize: number) => Promise<ListResponse>;

function getItems(result: ListResponse, collectionKey: string): unknown[] {
  const items = result[collectionKey];
  return Array.isArray(items) ? items : [];
}

function getReturnedCount(result: ListResponse, collectionKey: string): number {
  return getItems(result, collectionKey).length;
}

function getReportedTotal(result: ListResponse): number | null {
  const total = result.total ?? result.count ?? result.totalCount;
  return typeof total === "number" ? total : null;
}

export async function inferTotal(
  fetchPage: FetchPage,
  collectionKey: string,
  pageSize: number,
  firstPage?: ListResponse,
): Promise<number> {
  const first = firstPage ?? await fetchPage(0, pageSize);
  const reported = getReportedTotal(first);
  if (reported !== null) return reported;

  const firstCount = getReturnedCount(first, collectionKey);
  if (firstCount < pageSize) return firstCount;

  let lowPage = 0;
  let highPage = 1;
  let highPageResult = await fetchPage(highPage * pageSize, pageSize);
  let highCount = getReturnedCount(highPageResult, collectionKey);

  while (highCount === pageSize && highPage < 1024) {
    lowPage = highPage;
    highPage *= 2;
    highPageResult = await fetchPage(highPage * pageSize, pageSize);
    highCount = getReturnedCount(highPageResult, collectionKey);
  }

  if (highCount > 0 && highCount < pageSize) {
    return highPage * pageSize + highCount;
  }

  while (lowPage + 1 < highPage) {
    const midPage = Math.floor((lowPage + highPage) / 2);
    const mid = await fetchPage(midPage * pageSize, pageSize);
    if (getReturnedCount(mid, collectionKey) > 0) {
      lowPage = midPage;
    } else {
      highPage = midPage;
    }
  }

  const last = await fetchPage(lowPage * pageSize, pageSize);
  return lowPage * pageSize + getReturnedCount(last, collectionKey);
}

export function withPaginationMeta(
  result: unknown,
  collectionKey: string,
  offset: number,
  pageSize: number,
  totalOverride?: number | null,
): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const response = result as ListResponse;
  const returnedCount = getReturnedCount(response, collectionKey);
  const total = totalOverride ?? getReportedTotal(response);
  return {
    ...response,
    _meta: {
      offset,
      pageSize,
      returnedCount,
      total,
      hasMore: total !== null ? offset + returnedCount < total : returnedCount === pageSize,
    },
  };
}

export function reverseCollection(result: ListResponse, collectionKey: string): ListResponse {
  return {
    ...result,
    [collectionKey]: [...getItems(result, collectionKey)].reverse(),
  };
}
