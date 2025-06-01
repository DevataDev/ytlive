'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { MonitorTable } from './components/MonitorTable';
import { AddMonitorModal } from './components/AddMonitorModal';
import { EditMonitorModal } from './components/EditMonitorModal';
import { Monitor, MonitorFormData } from './types/monitor';
import { fetchMonitors, createMonitor, updateMonitor, deleteMonitor, toggleMonitorStatus, MonitorData } from '@/services/monitorService';

export default function MonitorPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const updateDataMonitors = (data: MonitorData[], total: number) => {
    const monitors = data.map((monitor) => ({
      id: monitor.ID,
      username: monitor.UniqueId,
      displayName: monitor.UniqueId,
      avatar: '',
      isActive: monitor.IsLive,
      lastChecked: monitor.LastCheckedAt,
      status: monitor.IsLive ? 'online' : 'offline',
      createdAt: monitor.CreatedAt,
      updatedAt: monitor.UpdatedAt
    }) as Monitor);
    setMonitors(monitors);
    setTotal(total);
  };

  const loadMonitors = async () => {
    try {
      setLoading(true);
      const { data, total } = await fetchMonitors(page, pageSize, searchTerm);
      updateDataMonitors(data, total);
    } catch (err) {
      setError('Failed to load monitors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitors();
  }, [page, searchTerm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadMonitors();
  };

  const handleAddMonitor = async (data: MonitorFormData) => {
    try {
      await createMonitor(data);
      setShowAddModal(false);
      loadMonitors();
    } catch (err) {
      setError('Failed to add monitor');
      console.error(err);
    }
  };

  const handleUpdateMonitor = async (id: string, data: Partial<MonitorFormData>) => {
    try {
      await updateMonitor(id, data);
      setEditingMonitor(null);
      loadMonitors();
    } catch (err) {
      setError('Failed to update monitor');
      console.error(err);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this monitor?')) {
      try {
        await deleteMonitor(id);
        loadMonitors();
      } catch (err) {
        setError('Failed to delete monitor');
        console.error(err);
      }
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await toggleMonitorStatus(id, isActive);
      loadMonitors();
    } catch (err) {
      setError('Failed to update monitor status');
      console.error(err);
    }
  };

  return (
    <Container fluid className="py-4">
      <div className="container-xxl">
      <Row className="mb-4">
        <Col>
          <h1 className="h3 mb-0">Monitor Management</h1>
          <p className="text-muted mb-0">Manage your monitored TikTok users</p>
        </Col>
      </Row>

      <Card className="shadow-sm mb-4">
        <Card.Body className="p-4">
          <Row className="align-items-center mb-4">
            <Col md={6} className="mb-3 mb-md-0">
              <h5 className="mb-0">
                <i className="bi bi-list-ul text-primary me-2"></i>
                Monitored Users
              </h5>
            </Col>
            <Col md={6} className="text-md-end">
              <Button
                variant="primary"
                onClick={() => setShowAddModal(true)}
                className="d-inline-flex align-items-center"
              >
                <i className="bi bi-plus-lg me-2"></i>
                Add Monitor
              </Button>
            </Col>
          </Row>

          <Form onSubmit={handleSearch} className="mb-4">
            <Row>
              <Col md={6}>
                <Form.Group controlId="search">
                  <div className="input-group">
                    <Form.Control
                      type="text"
                      placeholder="Search by username..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button variant="outline-secondary" type="submit">
                      <i className="bi bi-search"></i>
                    </Button>
                  </div>
                </Form.Group>
              </Col>
            </Row>
          </Form>

          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}

          <div className="table-responsive">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2 mb-0">Loading monitors...</p>
              </div>
            ) : (
              <MonitorTable
                monitors={monitors}
                onEdit={setEditingMonitor}
                onDelete={handleDeleteMonitor}
                onToggleStatus={handleToggleStatus}
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            )}
          </div>
        </Card.Body>
      </Card>

      <AddMonitorModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        onSave={handleAddMonitor}
      />

      {editingMonitor && (
        <EditMonitorModal
          show={!!editingMonitor}
          onHide={() => setEditingMonitor(null)}
          monitor={editingMonitor}
          onSave={handleUpdateMonitor}
        />
      )}
      </div>
    </Container>
  );
}
