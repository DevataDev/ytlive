import React from 'react';
import { Button } from 'react-bootstrap';
import { BsCheckCircle, BsCircle, BsArrowRepeat, BsTrash } from 'react-icons/bs';
import { toast } from 'react-toastify';
import { MirrorItem } from '@/services/mirrorService';

interface MirrorCardProps {
  mirror: MirrorItem;
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
    <div>
      <div className="card h-100 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{mirror.Title || 'Unnamed Mirror'}</h5>
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
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted">Status</span>
              {getStatusBadge()}
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">Room Status</span>
              {getHostStatusBadge()}
            </div>
          </div>
          
          {mirror.StreamKey && (
            <div className="mb-3">
              <label className="form-label small text-muted mb-1">Stream Key</label>
              <div className="input-group input-group-sm">
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
                    toast.success('Stream key copied to clipboard');
                  }}
                  title="Copy to clipboard"
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>
          )}
          
          {mirror.RtmpUrl && (
            <div className="mb-3">
              <label className="form-label small text-muted mb-1">Stream URL</label>
              <div className="input-group input-group-sm">
                <input 
                  type="text" 
                  className="form-control form-control-sm" 
                  value={mirror.RtmpUrl} 
                  readOnly 
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(mirror.RtmpUrl || '');
                    toast.success('Stream URL copied to clipboard');
                  }}
                  title="Copy to clipboard"
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>
          )}
          
          {mirror.StreamKey && (
            <div className="d-grid">
              <button
                className={`btn btn-sm btn-block ${isLive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => onToggle(mirror.ID, isLive ? 'stop' : 'start')}
                disabled={!canStart || isQueued || isProcessing}
              >
                {isProcessing ? (
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                ) : null}
                {isLive ? 'Stop Mirroring' : isQueued ? 'Queued' : 'Start Mirroring'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MirrorCard;
