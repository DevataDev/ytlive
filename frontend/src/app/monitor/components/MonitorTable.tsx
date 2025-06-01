import { Table, Button, Badge, Pagination } from 'react-bootstrap';
import { Monitor } from '../types/monitor';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

interface MonitorTableProps {
  monitors: Monitor[];
  onEdit: (monitor: Monitor) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, isActive: boolean) => void;
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
  page,
  pageSize,
  total,
  onPageChange,
}: MonitorTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

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
                        src={monitor.avatar || '/default-avatar.png'}
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
                      onClick={() => onDelete(monitor.id)}
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
