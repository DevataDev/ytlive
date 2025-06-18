'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleDoubleLeft, faAngleLeft, faAngleRight, faAngleDoubleRight } from '@fortawesome/free-solid-svg-icons';

interface PaginationProps {
  currentPage: number;
  maxPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
}

export default function Pagination({ currentPage, maxPage, onPageChange, itemsPerPage }: PaginationProps) {
  return (
    <div className="flex items-center space-x-4">
      <nav className="flex items-center space-x-1" aria-label="Pagination">
        <button
          className={`inline-flex items-center px-2 py-2 text-sm font-medium rounded-md ${
            currentPage === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          aria-label="First page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          <FontAwesomeIcon icon={faAngleDoubleLeft} className="h-4 w-4" />
        </button>
        
        <button
          className={`inline-flex items-center px-2 py-2 text-sm font-medium rounded-md ${
            currentPage === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          aria-label="Previous page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <FontAwesomeIcon icon={faAngleLeft} className="h-4 w-4" />
        </button>
        
        <span className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md">
          Page {currentPage} of {maxPage}
        </span>
        
        <button
          className={`inline-flex items-center px-2 py-2 text-sm font-medium rounded-md ${
            currentPage >= maxPage
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          aria-label="Next page"
          disabled={currentPage >= maxPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <FontAwesomeIcon icon={faAngleRight} className="h-4 w-4" />
        </button>
        
        <button
          className={`inline-flex items-center px-2 py-2 text-sm font-medium rounded-md ${
            currentPage >= maxPage
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          aria-label="Last page"
          disabled={currentPage >= maxPage}
          onClick={() => onPageChange(maxPage)}
        >
          <FontAwesomeIcon icon={faAngleDoubleRight} className="h-4 w-4" />
        </button>
      </nav>
      
      <div className="hidden md:block text-sm text-gray-500">
        {itemsPerPage} per page
      </div>
    </div>
  );
}