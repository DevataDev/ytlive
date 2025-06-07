import { Table, Badge, Button, Pagination } from 'react-bootstrap';
import { Monitor } from '../types/monitor';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

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
      return <Badge bg="secondary">Paused</Badge>;
    }

    switch (monitor.status) {
      case 'online':
        return (
          <Badge bg="success" className="d-flex align-items-center">
            <span className="me-1">•</span> Online
          </Badge>
        );
      case 'offline':
        return (
          <Badge bg="secondary" className="d-flex align-items-center">
            <span className="me-1">•</span> Offline
          </Badge>
        );
      case 'error':
        return (
          <Badge bg="danger" className="d-flex align-items-center">
            <span className="me-1">•</span> Error
          </Badge>
        );
      default:
        return (
          <Badge bg="warning" className="d-flex align-items-center">
            <span className="me-1">•</span> Unknown
          </Badge>
        );
    }
  };

  return (
    <>
      <Table hover className="align-middle">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Last Checked</th>
            <th>Created</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {monitors.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-muted">
                No monitors found
              </td>
            </tr>
          ) : (
            monitors.map((monitor) => (
              <tr key={monitor.id}>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="avatar me-3">
                      <Image
                        src={getAvatar(monitor.username) || '/default-avatar.png'}
                        alt={monitor.username}
                        width={40}
                        height={40}
                        className="rounded-circle"
                      />
                    </div>
                    <div>
                      <div className="fw-medium">{monitor.displayName}</div>
                      <div className="text-muted small">@{monitor.username}</div>
                    </div>
                  </div>
                </td>
                <td>{getStatusBadge(monitor)}</td>
                <td>
                  {monitor.lastChecked
                    ? formatDistanceToNow(new Date(monitor.lastChecked), { addSuffix: true })
                    : 'Never'}
                </td>
                <td>{formatDistanceToNow(new Date(monitor.createdAt), { addSuffix: true })}</td>
                <td className="text-end">
                  <div className="d-flex justify-content-end gap-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => onToggleStatus(monitor.id, !monitor.isActive)}
                      title={monitor.isActive ? 'Pause' : 'Resume'}
                    >
                      <i className={`bi ${monitor.isActive ? 'bi-pause' : 'bi-play'}`}></i>
                    </Button>
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => onBindChannel(monitor)}
                      title="Bind Channel"
                    >
                      <i className="bi bi-link-45deg"></i>
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => onEdit(monitor)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => onDelete(monitor)} // Changed to pass monitor object
                      title="Delete"
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {total > 0 && (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center pt-3 border-top">
          <div className="text-muted small mb-3 mb-md-0">
            Showing {startItem} to {endItem} of {total} monitors
          </div>
          <Pagination className="mb-0">
            <Pagination.Prev
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            />
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
                <Pagination.Item
                  key={pageNum}
                  active={pageNum === page}
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Pagination.Item>
              );
            })}
            <Pagination.Next
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </Pagination>
        </div>
      )}
    </>
  );
}
