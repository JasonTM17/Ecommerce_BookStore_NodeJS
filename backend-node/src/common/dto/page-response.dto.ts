export class PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function toPageResponse<T>(
  content: T[],
  totalElements: number,
  page: number,
  size: number,
): PageResponse<T> {
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  const response = new PageResponse<T>();
  response.content = content;
  response.page = page;
  response.size = size;
  response.totalElements = totalElements;
  response.totalPages = totalPages;
  response.first = page <= 0;
  response.last = page >= totalPages - 1;
  response.hasNext = page < totalPages - 1;
  response.hasPrevious = page > 0;
  return response;
}
