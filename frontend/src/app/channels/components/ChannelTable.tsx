'use client';

import { Channel } from '@/services/channelService';
import { getInitialsAvatar } from '../utils/avatarUtils';
import Pagination from './Pagination';

interface ChannelTableProps {
  channels: Channel[];
  loading: boolean;
  onDeleteClick: (channel: Channel) => void;
  currentPage: number;
  totalChannels: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function ChannelTable({
  channels,
  loading,
  onDeleteClick,
  currentPage,
  totalChannels,
  itemsPerPage,
  onPageChange
}: ChannelTableProps) {
  const maxPage = Math.ceil(totalChannels / itemsPerPage) || 1;
  const start = totalChannels > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const end = Math.min(currentPage * itemsPerPage, totalChannels);

  if (loading) {
    return (
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Channel</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Channel</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="text-center py-5">
                  <div className="py-4">
                    <i className="bi bi-collection text-muted" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
                    <h5 className="mt-3 mb-2">No channels found</h5>
                    <p className="text-muted mb-0">Add a channel to get started</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Channel</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.ID} className="fade-in">
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <img
                        src={channel.ThumbnailURL || getInitialsAvatar(channel.ChannelName)}
                        alt={channel.ChannelName || 'Channel'}
                        className="rounded-circle me-3"
                        style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getInitialsAvatar(channel.ChannelName);
                        }}
                      />
                      <div>
                        <div className="fw-medium text-dark mb-1">
                          {channel.ChannelName || 'Unnamed Channel'}
                        </div>
                        <div className="small text-muted font-monospace" title={`Channel ID: ${channel.ID}`}>
                          {channel.ID}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-success">
                      <i className="bi bi-check-circle-fill me-1"></i> Connected
                    </span>
                  </td>
                  <td className="text-end pe-4">
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onDeleteClick(channel)}
                    >
                      <i className="bi bi-trash"></i> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-footer bg-white border-top-0 pt-0">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center">
          <div className="text-muted small mb-2 mb-md-0">
            Showing {start} to {end} of <span className="fw-medium">{totalChannels}</span> channels
          </div>
          <Pagination
            currentPage={currentPage}
            maxPage={maxPage}
            onPageChange={onPageChange}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>
    </>
  );
}