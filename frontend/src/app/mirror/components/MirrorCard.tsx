import React from 'react';
import { Button } from 'react-bootstrap';
import { BsCheckCircle, BsCircle, BsArrowRepeat, BsTrash } from 'react-icons/bs';
import { Mirror } from '../types/mirror';

interface MirrorCardProps {
  mirror: Mirror;
  onToggle: (id: string, action: 'start' | 'stop') => void;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  isProcessing: boolean;
}

export const MirrorCard: React.FC<MirrorCardProps> = ({
  mirror,
  onToggle,
  onDelete,
  onRefresh,
  isProcessing
}) => {
  const status = (mirror.Status || '').toLowerCase();
  const isLive = status === 'live';
  const isQueued = status === 'queued';
  const canStart = mirror.IsAlive && mirror.StreamKey && !isLive;
  
  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="badge bg-success">
          <BsCircle className="me-1" /> Live
        </span>
      );
    } else if (isQueued) {
      return (
        <span className="badge bg-warning text-dark">
          <BsCircle className="me-1" /> Queued
        </span>
      );
    } else {
      return (
        <span className="badge bg-secondary">
          <BsCircle className="me-1" /> Offline
        </span>
      );
    }
  };

  const getHostStatusBadge = () => (
    mirror.IsAlive ? (
      <span className="badge bg-success">
        <BsCheckCircle className="me-1" /> Room Online
      </span>
    ) : (
      <span className="badge bg-danger">
        <BsCircle className="me-1" /> Room Offline
      </span>
    )
  );

  return (
    <div className="">
      <div className="card h-100">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{mirror.Name || 'Unnamed Mirror'}</h5>
          <div>
            <button 
              className="btn btn-sm btn-outline-secondary me-1" 
              onClick={() => onRefresh(mirror.ID)}
              disabled={isProcessing}
              title="Refresh Status"
            >
              <BsArrowRepeat className={isProcessing ? 'fa-spin' : ''} />
            </button>
            <button 
              className="btn btn-sm btn-outline-danger" 
              onClick={() => onDelete(mirror.ID)}
              disabled={isProcessing}
              title="Delete Mirror"
            >
              <BsTrash />
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-2">
            <strong>Status:</strong> {getStatusBadge()}
          </div>
          <div className="mb-2">
            <strong>Room Status:</strong> {getHostStatusBadge()}
          </div>
          {mirror.StreamKey && (
            <div className="mb-2">
              <strong>Stream Key:</strong>
              <div className="input-group input-group-sm mt-1">
                <input 
                  type="text" 
                  className="form-control form-control-sm" 
                  value={mirror.StreamKey} 
                  readOnly 
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(mirror.StreamKey || '');
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          {mirror.StreamURL && (
            <div className="mb-2">
              <strong>Stream URL:</strong>
              <div className="input-group input-group-sm mt-1">
                <input 
                  type="text" 
                  className="form-control form-control-sm" 
                  value={mirror.StreamURL} 
                  readOnly 
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(mirror.StreamURL || '');
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          {mirror.StreamKey && (
            <div className="mt-3 d-grid">
              <Button
                variant={isLive ? 'danger' : 'primary'}
                size="sm"
                onClick={() => onToggle(mirror.ID, isLive ? 'stop' : 'start')}
                disabled={!canStart || isQueued || isProcessing}
              >
                {isLive ? 'Stop' : isQueued ? 'Queued' : 'Start Mirroring'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MirrorCard;
