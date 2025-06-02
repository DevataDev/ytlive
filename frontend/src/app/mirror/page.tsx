'use client';

import { useEffect, useState } from 'react';
import { Container, Row, Col, Spinner, Button, Modal } from 'react-bootstrap';
import { BsPlus, BsArrowRepeat } from 'react-icons/bs';
import { Mirror } from './types/mirror';
import { MirrorCard } from './components/MirrorCard';
import CreateMirrorModal from './components/CreateMirrorModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { getMirrors } from '@/services/mirrorService';

export default function MirrorPage() {
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
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
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Mirrors</h1>
        <div>
          <Button 
            variant="primary" 
            onClick={() => setShowCreateModal(true)}
            disabled={isProcessing}
            className="me-2"
          >
            <BsPlus className="me-2" />
            Create Mirror
          </Button>
          <Button 
            variant="outline-secondary" 
            onClick={fetchMirrors}
            disabled={isProcessing}
          >
            <BsArrowRepeat className={isProcessing ? 'fa-spin me-2' : 'me-2'} />
            Refresh
          </Button>
        </div>
      </div>

      {mirrors.length === 0 ? (
        <div className="text-center py-5">
          <h4>No mirrors found</h4>
          <p className="text-muted">Create your first mirror to get started</p>
          <Button 
            variant="primary" 
            onClick={() => setShowCreateModal(true)}
            disabled={isProcessing}
          >
            <BsPlus className="me-2" />
            Create Mirror
          </Button>
        </div>
      ) : (
        <Row>
          {mirrors.map((mirror) => (
            <Col key={mirror.ID} xs={12} md={6} lg={4} className="mb-4">
              <MirrorCard
                mirror={mirror}
                onToggle={handleToggleMirror}
                onDelete={handleDeleteMirror}
                onRefresh={handleRefresh}
                isProcessing={isProcessing}
              />
            </Col>
          ))}
        </Row>
      )}

      <CreateMirrorModal 
        show={showCreateModal} 
        onHide={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </Container>
  );
}
