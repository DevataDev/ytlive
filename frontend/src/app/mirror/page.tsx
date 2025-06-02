'use client';

import { useState, useEffect } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import { BsPlusCircle, BsArrowRepeat } from 'react-icons/bs';
import { MirrorCard } from './components/MirrorCard';
import CreateMirrorModal from './components/CreateMirrorModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { getMirrors, MirrorItem } from '@/services/mirrorService';

export default function MirrorPage() {
  const [mirrors, setMirrors] = useState<MirrorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      const response = await fetch(`/api/mirrors/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} mirror`);
      }

      await fetchMirrors();
      toast.success(`Mirror ${action}ped successfully`);
    } catch (error) {
      console.error(`Error ${action}ing mirror:`, error);
      toast.error(`Failed to ${action} mirror`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMirror = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this mirror?')) {
      return;
    }

    try {
      setIsProcessing(true);
      const token = session?.user?.backendToken;
      const response = await fetch(`/api/mirrors/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete mirror');
      }

      setMirrors(mirrors.filter(mirror => mirror.ID !== id));
      toast.success('Mirror deleted successfully');
    } catch (error) {
      console.error('Error deleting mirror:', error);
      toast.error('Failed to delete mirror');
    } finally {
      setIsProcessing(false);
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
      <Container className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading mirrors...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Mirror Management</h1>
        <div>
          <button 
            className="btn btn-primary me-2" 
            onClick={() => setShowCreateModal(true)}
            disabled={isProcessing}
          >
            <BsPlusCircle className="me-1" /> Create New Mirror
          </button>
          <button 
            className="btn btn-outline-secondary" 
            onClick={fetchMirrors}
            disabled={isProcessing}
          >
            <BsArrowRepeat className={isProcessing ? 'fa-spin me-1' : 'me-1'} />
            Refresh
          </button>
        </div>
      </div>

      {mirrors.length === 0 ? (
        <div className="text-center my-5 p-5 bg-light rounded">
          <h4 className="text-muted mb-3">No mirrors found</h4>
          <p className="text-muted">Create your first mirror to get started</p>
          <button 
            className="btn btn-primary mt-2"
            onClick={() => setShowCreateModal(true)}
            disabled={isProcessing}
          >
            <BsPlusCircle className="me-1" /> Create Mirror
          </button>
        </div>
      ) : (
        <div className="row">
          {mirrors.map((mirror) => (
            <div key={mirror.ID} className="col-12 col-md-6 col-lg-4 mb-4">
              <MirrorCard 
                mirror={mirror} 
                onToggle={handleToggleMirror} 
                onDelete={handleDeleteMirror}
                onRefresh={handleRefresh}
                isProcessing={isProcessing}
              />
            </div>
          ))}
        </div>
      )}

      <CreateMirrorModal 
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </Container>
  );
}
