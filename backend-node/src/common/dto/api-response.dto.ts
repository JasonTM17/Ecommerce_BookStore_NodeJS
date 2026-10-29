export class ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
  timestamp: number;

  static success<T>(data?: T, message?: string): ApiResponse<T> {
    const response = new ApiResponse<T>();
    response.success = true;
    if (data !== undefined && data !== null) response.data = data;
    if (message !== undefined && message !== null) response.message = message;
    response.timestamp = Date.now();
    return response;
  }

  static error<T>(message: string, errors?: unknown): ApiResponse<T> {
    const response = new ApiResponse<T>();
    response.success = false;
    response.message = message;
    if (errors !== undefined) response.errors = errors;
    response.timestamp = Date.now();
    return response;
  }
}

/**
 * Mirrors Spring Data `Page<T>` JSON shape because several original
 * controllers return `ApiResponse<Page<T>>` rather than PageResponse.
 */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  pageable: {
    pageNumber: number;
    pageSize: number;
    offset: number;
    paged: boolean;
    unpaged: boolean;
    sort: { sorted: boolean; unsorted: boolean; empty: boolean };
  };
  sort: { sorted: boolean; unsorted: boolean; empty: boolean };
}

export function toSpringPage<T>(
  content: T[],
  totalElements: number,
  page: number,
  size: number,
): SpringPage<T> {
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page <= 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
    pageable: {
      pageNumber: page,
      pageSize: size,
      offset: page * size,
      paged: true,
      unpaged: false,
      sort: { sorted: true, unsorted: false, empty: false },
    },
    sort: { sorted: true, unsorted: false, empty: false },
  };
}
