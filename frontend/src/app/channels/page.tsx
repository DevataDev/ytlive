'use client';

import { useState, useEffect } from 'react';
import { toast, ToastIcon } from 'react-toastify';
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
    <div className="container-fluid">
      <div className="container-xl">
        <div className="card shadow-sm border-0 rounded-3 overflow-hidden mb-4">
          <div className="card-header bg-white border-bottom-0 py-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center">
              <div className="mb-3 mb-md-0">
                <h2 className="h5 mb-0 d-flex align-items-center">
                  <i className="bi bi-collection-play-fill text-primary me-2"></i>
                  <span>YouTube Channels</span>
                </h2>
              </div>
              <div className="d-flex">
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleAddChannel}
                >
                  <i className="bi bi-plus-lg me-1"></i> Add Channel
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