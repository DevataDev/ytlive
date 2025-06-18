'use client';
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSync } from '@fortawesome/free-solid-svg-icons';
import { MirrorCard } from './components/MirrorCard';
import CreateMirrorModal from './components/CreateMirrorModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { actionMirror, deleteMirror, getMirrors, MirrorItem } from '@/services/mirrorService';
import DeleteMirrorModal from './components/DeleteMirrorModal';

export default function MirrorPage() {
  const [mirrors, setMirrors] = useState<MirrorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Add these new state variables for the delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mirrorToDelete, setMirrorToDelete] = useState<MirrorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchMirrors();
    }
  }, [status, router]);

  const fetchMirrors = async () => {
    try {
      setIsLoading(true);
      const response = await getMirrors();

      if (!response.mirrors) {
        throw new Error('Failed to fetch mirrors');
      }

      setMirrors(response.mirrors);
    } catch (error) {
      console.error('Error fetching mirrors:', error);
      toast.error('Failed to load mirrors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMirror = async (id: string, action: 'start' | 'stop') => {
    try {
      setIsProcessing(true);
      const token = session?.user?.backendToken;
      const response = await actionMirror(id, action);

      await fetchMirrors();
      toast.success(`Mirror ${action}ped successfully`);
    } catch (error) {
      console.error(`Error ${action}ing mirror:`, error);
      toast.error(`Failed to ${action} mirror`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Replace the existing handleDeleteMirror function
  const handleDeleteMirror = async () => {
    if (!mirrorToDelete) return;

    try {
      setIsDeleting(true);
      const token = session?.user?.backendToken;
      const response = await deleteMirror(mirrorToDelete.ID); // Change this lin

      setMirrors(mirrors.filter(mirror => mirror.ID !== mirrorToDelete.ID));
      toast.success('Mirror deleted successfully');
      setShowDeleteModal(false);
      setMirrorToDelete(null);
    } catch (error) {
      console.error('Error deleting mirror:', error);
      toast.error('Failed to delete mirror');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add this new function to show the delete modal
  const handleDeleteClick = (mirror: MirrorItem) => {
    setMirrorToDelete(mirror);
    setShowDeleteModal(true);
  };

  // Add this function to hide the delete modal
  const handleHideDeleteModal = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setMirrorToDelete(null);
    }
  };

  const handleRefresh = async (id: string) => {
    try {
      setIsProcessing(true);
      await fetchMirrors();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchMirrors();
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading mirrors...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mirror Management</h1>
            <p className="text-gray-600">Manage your streaming mirrors</p>
          </div>
          <div className="flex space-x-3">
            <button 
              className={`inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                isProcessing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={fetchMirrors}
              disabled={isProcessing}
            >
              <FontAwesomeIcon 
                icon={faSync} 
                className={`mr-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} 
              />
              Refresh
            </button>
            <button 
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                isProcessing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => setShowCreateModal(true)}
              disabled={isProcessing}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2 h-4 w-4" />
              Create New Mirror
            </button>
          </div>
        </div>

        {/* Mirror List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {mirrors.length === 0 ? (
            <div className="text-center py-12 px-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No mirrors found</h3>
              <p className="text-gray-500 mb-6">
                Create your first mirror to get started
              </p>
              <button 
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => setShowCreateModal(true)}
                disabled={isProcessing}
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2 h-4 w-4" />
                Create Mirror
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {mirrors.map((mirror) => (
                <div key={mirror.ID}>
                  <MirrorCard 
                    mirror={mirror} 
                    onToggle={handleToggleMirror} 
                    onDelete={() => handleDeleteClick(mirror)} // Change this line
                    onRefresh={handleRefresh}
                    isProcessing={isProcessing}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <CreateMirrorModal 
          show={showCreateModal}
          onHide={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />

        {/* Add the DeleteMirrorModal component */}
        <DeleteMirrorModal
          show={showDeleteModal}
          mirror={mirrorToDelete}
          deleting={isDeleting}
          onHide={handleHideDeleteModal}
          onConfirm={handleDeleteMirror}
        />
      </div>
    </div>
  );
}
