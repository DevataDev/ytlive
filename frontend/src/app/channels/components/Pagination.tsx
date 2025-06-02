'use client';

interface PaginationProps {
  currentPage: number;
  maxPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
}

export default function Pagination({ currentPage, maxPage, onPageChange, itemsPerPage }: PaginationProps) {
  return (
    <div className="d-flex align-items-center">
      <nav aria-label="Page navigation">
        <ul className="pagination pagination-sm mb-0">
          <li className="page-item">
            <button
              className="page-link"
              aria-label="First"
              disabled={currentPage === 1}
              onClick={() => onPageChange(1)}
            >
              <i className="bi bi-chevron-bar-left"></i>
            </button>
          </li>
          <li className="page-item">
            <button
              className="page-link"
              aria-label="Previous"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
          </li>
          <li className="page-item disabled">
            <span className="page-link text-muted">
              Page {currentPage} of {maxPage}
            </span>
          </li>
          <li className="page-item">
            <button
              className="page-link"
              aria-label="Next"
              disabled={currentPage >= maxPage}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </li>
          <li className="page-item">
            <button
              className="page-link"
              aria-label="Last"
              disabled={currentPage >= maxPage}
              onClick={() => onPageChange(maxPage)}
            >
              <i className="bi bi-chevron-bar-right"></i>
            </button>
          </li>
        </ul>
      </nav>
      <div className="ms-2 small text-muted d-none d-md-block">
        {itemsPerPage} per page
      </div>
    </div>
  );
}