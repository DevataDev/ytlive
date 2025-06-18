'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faCheckCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
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
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center">
                  <div className="py-8">
                    <FontAwesomeIcon icon={faVideo} className="h-12 w-12 text-gray-400 mb-4" />
                    <h5 className="text-lg font-medium text-gray-900 mb-2">No channels found</h5>
                    <p className="text-gray-500">Add a channel to get started</p>
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
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {channels.map((channel) => (
                <tr key={channel.ID} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src={channel.ThumbnailURL || getInitialsAvatar(channel.ChannelName)}
                        alt={channel.ChannelName || 'Channel'}
                        className="h-9 w-9 rounded-full object-cover mr-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getInitialsAvatar(channel.ChannelName);
                        }}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {channel.ChannelName || 'Unnamed Channel'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono" title={`Channel ID: ${channel.ID}`}>
                          {channel.ID}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <FontAwesomeIcon icon={faCheckCircle} className="mr-1 h-3 w-3" />
                      Connected
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      className="inline-flex items-center px-3 py-2 border border-red-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      onClick={() => onDeleteClick(channel)}
                    >
                      <FontAwesomeIcon icon={faTrash} className="mr-2 h-3 w-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-gray-700 mb-2 md:mb-0">
            Showing {start} to {end} of <span className="font-medium">{totalChannels}</span> channels
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