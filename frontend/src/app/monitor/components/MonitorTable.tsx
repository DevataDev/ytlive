import { Monitor } from '../types/monitor';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlay, 
  faPause, 
  faLink, 
  faPencil, 
  faTrash, 
  faChevronLeft, 
  faChevronRight 
} from '@fortawesome/free-solid-svg-icons';

interface MonitorTableProps {
  monitors: Monitor[];
  onEdit: (monitor: Monitor) => void;
  onDelete: (monitor: Monitor) => void; // Changed to pass the monitor object
  onToggleStatus: (id: string, isActive: boolean) => void;
  onBindChannel: (monitor: Monitor) => void; // Added bind channel functionality
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function MonitorTable({
  monitors,
  onEdit,
  onDelete,
  onToggleStatus,
  onBindChannel, // Added bind channel prop
  page,
  pageSize,
  total,
  onPageChange,
}: MonitorTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const getAvatar = (username: string, size: number = 40) => {
    const initials = (username || 'TT')
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    // Generate a consistent color based on the name
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEEAD', '#D4A5A5', '#9B97B2', '#E8A87C',
      '#C38D9E', '#85DCB', '#E8A87C', '#41B3A3'
    ];

    // Simple hash function to get consistent color for same name
    let hash = 0;
    for (let i = 0; i < (username || '').length; i++) {
      hash = (username || '').charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;

    // Create SVG with the initials
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="${colors[colorIndex]}" rx="8"/>
          <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" 
                fill="white" text-anchor="middle" dy=".3em" font-weight="bold">
              ${initials}
          </text>
      </svg>
  `;

    // Convert SVG to data URL
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  };

  const getStatusBadge = (monitor: Monitor) => {
    if (!monitor.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Paused
        </span>
      );
    }

    switch (monitor.status) {
      case 'online':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="mr-1">•</span> Online
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <span className="mr-1">•</span> Offline
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="mr-1">•</span> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <span className="mr-1">•</span> Unknown
          </span>
        );
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Checked
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {monitors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No monitors found
                </td>
              </tr>
            ) : (
              monitors.map((monitor) => (
                <tr key={monitor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="mr-3">
                        <Image
                          src={getAvatar(monitor.username) || '/default-avatar.png'}
                          alt={monitor.username}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{monitor.displayName}</div>
                        <div className="text-sm text-gray-500">@{monitor.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(monitor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {monitor.lastChecked
                      ? formatDistanceToNow(new Date(monitor.lastChecked), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDistanceToNow(new Date(monitor.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onToggleStatus(monitor.id, !monitor.isActive)}
                        title={monitor.isActive ? 'Pause' : 'Resume'}
                        className="inline-flex items-center px-2.5 py-1.5 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <FontAwesomeIcon icon={monitor.isActive ? faPause : faPlay} />
                      </button>
                      <button
                        onClick={() => onBindChannel(monitor)}
                        title="Bind Channel"
                        className="inline-flex items-center px-2.5 py-1.5 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <FontAwesomeIcon icon={faLink} />
                      </button>
                      <button
                        onClick={() => onEdit(monitor)}
                        title="Edit"
                        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      >
                        <FontAwesomeIcon icon={faPencil} />
                      </button>
                      <button
                        onClick={() => onDelete(monitor)} // Changed to pass monitor object
                        title="Delete"
                        className="inline-flex items-center px-2.5 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {total > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center pt-3 border-t border-gray-200">
            <div className="text-sm text-gray-500 mb-3 md:mb-0">
              Showing {startItem} to {endItem} of {total} monitors
            </div>
            <nav className="flex items-center space-x-1">
              <button
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  page === 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      pageNum === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  page === totalPages
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
