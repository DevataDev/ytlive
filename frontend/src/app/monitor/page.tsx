'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListUl, faPlus, faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { MonitorTable } from './components/MonitorTable';
import { AddMonitorModal } from './components/AddMonitorModal';
import { EditMonitorModal } from './components/EditMonitorModal';
import DeleteMonitorModal from './components/DeleteMonitorModal';
import { Monitor, MonitorFormData } from './types/monitor';
import { fetchMonitors, createMonitor, updateMonitor, deleteMonitor, toggleMonitorStatus, MonitorData } from '@/services/monitorService';
import BindChannelModal from '@/components/modals/BindChannelModal';

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

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [monitorToDelete, setMonitorToDelete] = useState<Monitor | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bind channel modal states
  const [showBindModal, setShowBindModal] = useState(false);
  const [monitorToBind, setMonitorToBind] = useState<Monitor | null>(null);
  const [binding, setBinding] = useState(false);

  const updateDataMonitors = (data: MonitorData[], total: number) => {
    const monitors = data.map((monitor) => ({
      id: monitor.ID,
      username: monitor.UniqueId,
      displayName: monitor.UniqueId,
      avatar: '',
      isActive: !monitor.Paused,
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

  const handleDeleteClick = (monitor: Monitor) => {
    setMonitorToDelete(monitor);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!monitorToDelete) return;

    try {
      setDeleting(true);
      await deleteMonitor(monitorToDelete.id);
      toast.success('Monitor deleted successfully');
      setShowDeleteModal(false);
      setMonitorToDelete(null);
      loadMonitors();
    } catch (err) {
      setError('Failed to delete monitor');
      toast.error('Failed to delete monitor');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleBindChannelClick = (monitor: Monitor) => {
    setMonitorToBind(monitor);
    setShowBindModal(true);
  };

  const handleBindChannel = async (channelId: string, streamKey: string) => {
    if (!monitorToBind) return;

    try {
      setBinding(true);
      toast.success('Channel bound successfully');
      setShowBindModal(false);
      setMonitorToBind(null);
      loadMonitors();
    } catch (err) {
      toast.error('Failed to bind channel');
      console.error(err);
      throw err;
    } finally {
      setBinding(false);
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
    <div className="container mx-auto px-4 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="mb-3 md:mb-0">
                <h5 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FontAwesomeIcon icon={faListUl} className="text-blue-600 mr-2" />
                  Monitored Users
                </h5>
              </div>
              <div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  Add Monitor
                </button>
              </div>
            </div>

            <form onSubmit={handleSearch} className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by username..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <FontAwesomeIcon icon={faSearch} />
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-red-700">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-12">
                  <FontAwesomeIcon icon={faSpinner} className="text-2xl text-blue-600 animate-spin mb-2" />
                  <p className="text-gray-600">Loading monitors...</p>
                </div>
              ) : (
                <MonitorTable
                  monitors={monitors}
                  onEdit={setEditingMonitor}
                  onDelete={handleDeleteClick}
                  onToggleStatus={handleToggleStatus}
                  onBindChannel={handleBindChannelClick}
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                />
              )}
            </div>
          </div>
        </div>

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

        {/* New Delete Modal */}
        <DeleteMonitorModal
          show={showDeleteModal}
          monitor={monitorToDelete}
          deleting={deleting}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
        />

        {/* New Bind Channel Modal */}
        <BindChannelModal
          show={showBindModal}
          onHide={() => setShowBindModal(false)}
          onBind={handleBindChannel}
          title="Bind Channel to Monitor"
          streamName={monitorToBind?.displayName}
          loading={binding}
          fetchChannels={() => Promise.resolve([])} // You'll need to implement this
          fetchStreams={() => Promise.resolve([])} // You'll need to implement this
        />
      </div>
    </div>
  );
}
