import { useState } from 'react';

export function usePagination(initialPage = 1, initialLimit = 10) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const onPageChange = (newPage: number) => {
    setPage(newPage);
  };

  const onLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when limit changes
  };

  return {
    page,
    limit,
    onPageChange,
    onLimitChange,
    setPage,
  };
}
