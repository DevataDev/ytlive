'use client';

import { useState, useEffect } from 'react';
import { toast, ToastIcon } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faPlus } from '@fortawesome/free-solid-svg-icons';
import { 
  fetchListYoutubeChannels, 
  authorizeYouTubeChannel, 
  deleteYouTubeChannel, 
  Channel 
} from '@/services/channelService';
import ChannelTable from './components/ChannelTable';
import DeleteChannelModal from './components/DeleteChannelModal';
import { getInitialsAvatar } from './utils/avatarUtils';

const ITEMS_PER_PAGE = 10;

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalChannels = channels.length;
  const maxPage = Math.ceil(totalChannels / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalChannels);
  const paginatedChannels = channels.slice(startIndex, endIndex);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const channelList = await fetchListYoutubeChannels();
      setChannels(channelList);
    } catch (error) {
      console.error('Error loading channels:', error);
      toast.error('Failed to load channels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = async () => {
    try {
      const response = await authorizeYouTubeChannel();
      window.open(response.auth_url, '_blank');
      toast('Please authorize the application in the new tab');
    } catch (error) {
      console.error('Error adding channel:', error);
      toast.error('Failed to get authorization URL');
    }
  };

  const handleDeleteClick = (channel: Channel) => {
    setChannelToDelete(channel);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!channelToDelete) return;

    try {
      setDeleting(true);
      await deleteYouTubeChannel(channelToDelete.ID);
      toast.success('Channel deleted successfully');
      setShowDeleteModal(false);
      setChannelToDelete(null);
      await loadChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Failed to delete channel');
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, maxPage)));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="mb-3 md:mb-0">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <FontAwesomeIcon icon={faVideo} className="text-blue-600 mr-3 h-5 w-5" />
                  <span>YouTube Channels</span>
                </h2>
              </div>
              <div className="flex">
                <button 
                  type="button" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  onClick={handleAddChannel}
                >
                  <FontAwesomeIcon icon={faPlus} className="mr-2 h-4 w-4" />
                  Add Channel
                </button>
              </div>
            </div>
          </div>

          <ChannelTable
            channels={paginatedChannels}
            loading={loading}
            onDeleteClick={handleDeleteClick}
            currentPage={currentPage}
            totalChannels={totalChannels}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      <DeleteChannelModal
        show={showDeleteModal}
        channel={channelToDelete}
        deleting={deleting}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}