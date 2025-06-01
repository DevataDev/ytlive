'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatDistanceToNow } from 'date-fns';
import { DashboardWebSocket } from '@/lib/websocket';
import DashboardService from '@/services/dashboardService';
import { 
  WebSocketMetrics, 
  DashboardStats, 
  StorageInfo,
  StreamStats,
  SystemMetrics,
  RecentActivities
} from '@/services/dashboardService';
import styles from './dashboard.module.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [stats, setStats] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    ramTotal: 0,
    ramUsed: 0,
    upload: 0,
    download: 0,
  });
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    fileCounts: { audio: 0, videos: 0 },
    free: 0,
    total: 0,
    used: 0,
    used_percent: 0
  });
  const [networkData, setNetworkData] = useState({
    labels: Array(30).fill(''),
    download: Array(30).fill(0),
    upload: Array(30).fill(0)
  });
  const [streamStats, setStreamStats] = useState<StreamStats>({
    started: 0,
    scheduled: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivities>({
    activities: [],
    success: false,
  });

  // Format bytes to human readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format network speed
  const formatNetworkSpeed = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  // Update system metrics from WebSocket
  const updateSystemMetrics = useCallback((metrics: SystemMetrics) => {
    setStats(prev => ({
      ...prev,
      cpu: metrics.cpu,
      memory: metrics.memory,
      download: metrics.download,
      upload: metrics.upload
    }));

    setNetworkData(prev => ({
      labels: [...prev.labels.slice(1), new Date().toLocaleTimeString()],
      download: [...prev.download.slice(1), metrics.download],
      upload: [...prev.upload.slice(1), metrics.upload]
    }));

    setLastUpdated(new Date());
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status !== 'authenticated') return;

    DashboardService.connectWebSocket((metrics: SystemMetrics) => {
      updateSystemMetrics(metrics);
    }, (error) => {
      console.error('WebSocket error:', error);
    });

    // Initial data fetch
    const fetchInitialData = async () => {
      try {
        const storageInfo = await DashboardService.fetchStorageInfo();
        const streamInfo = await DashboardService.fetchStreamStats();
        const recentActivities = await DashboardService.fetchRecentActivities();
        setStorageInfo(storageInfo);
        setStreamStats(streamInfo);
        setRecentActivities(recentActivities);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [status, router, updateSystemMetrics]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.dashboardBody} min-vh-100 py-4`}>
      <div className="container-xxl">
        {/* Header */}
        <div className="row justify-content-center">
          <div className="col-12">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
              <div className="mb-3 mb-md-0">
                <h2 className="fw-bold mb-1">Dashboard Overview</h2>
                <p className="text-muted mb-0">Monitor your streams and system resources in real-time</p>
              </div>
              <div className="text-md-end">
                <p className="text-muted small mb-1">
                  Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                </p>
                <p className="text-muted small mb-0">
                  Status: <span className="text-success">Connected</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row g-4 mb-4">
          {/* Total Streams Card */}
          <div className="col-md-6 col-xl-3">
            <div className={`card ${styles.statCard} ${styles.bgGradientPrimary} text-white h-100`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className={`text-uppercase ${styles.textWhite50} mb-1`}>Total Streams</h6>
                    <h2 className="mb-0">{streamStats.total}</h2>
                  </div>
                  <div className={`${styles.iconShape} p-3`}>
                    <i className="bi bi-collection-play fs-4"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Streams Card */}
          <div className="col-md-6 col-xl-3">
            <div className={`card ${styles.statCard} ${styles.bgGradientInfo} text-white h-100`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className={`text-uppercase ${styles.textWhite50} mb-1`}>Live Vs Scheduled</h6>
                    <h2 className="mb-0">
                      {streamStats.started} <small className="fs-6">/ {streamStats.scheduled}</small>
                    </h2>
                  </div>
                  <div className={`${styles.iconShape} p-3`}>
                    <i className="bi bi-cast fs-4"></i>
                  </div>
                </div>
                <div className="mt-3">
                  <div className={`progress ${styles.bgWhite20}`} style={{ height: '4px' }}>
                    <div
                      className="progress-bar bg-white"
                      role="progressbar"
                      style={{
                        width: `${(streamStats.started / Math.max(streamStats.started + streamStats.scheduled, 1)) * 100}%`
                      }}
                      aria-valuenow={streamStats.started}
                      aria-valuemin={0}
                      aria-valuemax={streamStats.started + streamStats.scheduled}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CPU Usage Card */}
          <div className="col-md-6 col-xl-3">
            <div className={`card ${styles.statCard} ${styles.bgGradientWarning} text-white h-100`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className={`text-uppercase ${styles.textWhite50} mb-1`}>CPU Usage</h6>
                    <h2 className="mb-0">{(stats.cpu || 0).toFixed(1)}%</h2>
                  </div>
                  <div className={`${styles.iconShape} p-3`}>
                    <i className="bi bi-cpu fs-4"></i>
                  </div>
                </div>
                <div className="mt-3">
                  <div className={`progress ${styles.bgWhite20}`} style={{ height: '4px' }}>
                    <div
                      className="progress-bar bg-white"
                      role="progressbar"
                      style={{ width: `${stats.cpu || 0}%` }}
                      aria-valuenow={stats.cpu || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Usage Card */}
          <div className="col-md-6 col-xl-3">
            <div className={`card ${styles.statCard} ${styles.bgGradientDanger} text-white h-100`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className={`text-uppercase ${styles.textWhite50} mb-1`}>Memory Usage</h6>
                    <h2 className="mb-0">{(stats.memory || 0).toFixed(1)}%</h2>
                  </div>
                  <div className={`${styles.iconShape} p-3`}>
                    <i className="bi bi-memory fs-4"></i>
                  </div>
                </div>
                <div className="mt-3">
                  <div className={`progress ${styles.bgWhite20}`} style={{ height: '4px' }}>
                    <div
                      className="progress-bar bg-white"
                      role="progressbar"
                      style={{ width: `${stats.memory || 0}%` }}
                      aria-valuenow={stats.memory || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network and Storage Row */}
        <div className="row g-4 mb-4">
          {/* Network Traffic Card */}
          <div className="col-12 col-xl-8">
            <div className={`card ${styles.statCard} h-100`}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Network Traffic</h5>
                <div className="d-flex">
                  <div className="d-flex align-items-center me-3">
                    <span className={`${styles.legendIndicator} bg-primary me-2`}></span>
                    <small className="text-muted">Download</small>
                  </div>
                  <div className="d-flex align-items-center">
                    <span className={`${styles.legendIndicator} bg-success me-2`}></span>
                    <small className="text-muted">Upload</small>
                  </div>
                </div>
              </div>
              <div className="card-body p-3">
                {/* Network Stats */}
                <div className="row g-3 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="d-flex align-items-center">
                      <div className="bg-primary bg-opacity-10 rounded p-2 me-2">
                        <i className="bi bi-download text-primary"></i>
                      </div>
                      <div>
                        <p className="mb-0 small text-muted">Download</p>
                        <h6 className="mb-0">{(stats.download || 0).toFixed(2)} Mbps</h6>
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="d-flex align-items-center">
                      <div className="bg-success bg-opacity-10 rounded p-2 me-2">
                        <i className="bi bi-upload text-success"></i>
                      </div>
                      <div>
                        <p className="mb-0 small text-muted">Upload</p>
                        <h6 className="mb-0">{(stats.upload || 0).toFixed(2)} Mbps</h6>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Chart */}
                <div style={{ height: '200px' }}>
                  <Line
                    data={{
                      labels: networkData.labels,
                      datasets: [
                        {
                          label: 'Download',
                          data: networkData.download,
                          borderColor: '#4361ee',
                          backgroundColor: 'rgba(67, 97, 238, 0.1)',
                          borderWidth: 2,
                          tension: 0.3,
                          fill: true,
                          pointRadius: 0,
                        },
                        {
                          label: 'Upload',
                          data: networkData.upload,
                          borderColor: '#4cc9f0',
                          backgroundColor: 'rgba(76, 201, 240, 0.1)',
                          borderWidth: 2,
                          tension: 0.3,
                          fill: true,
                          pointRadius: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          mode: 'index',
                          intersect: false,
                          callbacks: {
                            label: function (context) {
                              return `${context.dataset.label}: ${context.raw.toFixed(0)}Mbps`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false,
                          },
                          ticks: {
                            maxRotation: 0,
                            maxTicksLimit: 6,
                          },
                        },
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                          },
                          ticks: {
                            callback: function (value) {
                              return `${value.toFixed(0)}Mbps`;
                            },
                          },
                        },
                      },
                      interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false,
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Storage Info Card */}
          <div className="col-12 col-xl-4">
            <div className={`card ${styles.statCard} h-100`}>
              <div className="card-header">
                <h5 className="mb-0">Storage Information</h5>
              </div>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h6 className={`text-uppercase ${styles.textMuted} small mb-1`}>Total Storage</h6>
                    <h4 className="mb-0">{(storageInfo.total / (1024 * 1024 * 1024)).toFixed(2)} GB</h4>
                  </div>
                  <div className="text-end">
                    <h6 className={`text-uppercase ${styles.textMuted} small mb-1`}>Used</h6>
                    <h4 className="mb-0">
                      {storageInfo.used_percent ? storageInfo.used_percent.toFixed(1) : 0}%
                    </h4>
                  </div>
                </div>
                <div className={`progress mb-4 ${styles.bgWhite20}`} style={{ height: '8px' }}>
                  <div
                    className="progress-bar bg-primary"
                    role="progressbar"
                    style={{ width: `${storageInfo.used_percent || 0}%` }}
                    aria-valuenow={storageInfo.used_percent || 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
                <div className="row g-3">
                  <div className="col-6">
                    <div className="d-flex align-items-center">
                      <div className={`${styles.iconShape} bg-primary bg-opacity-10 text-primary p-2 me-3`}>
                        <i className="bi bi-file-earmark-music fs-4"></i>
                      </div>
                      <div>
                        <h6 className="mb-0">{storageInfo.fileCounts.audio}</h6>
                        <small className="text-muted">Audio Files</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center">
                      <div className={`${styles.iconShape} bg-success bg-opacity-10 text-success p-2 me-3`}>
                        <i className="bi bi-camera-video fs-4"></i>
                      </div>
                      <div>
                        <h6 className="mb-0">{storageInfo.fileCounts.videos}</h6>
                        <small className="text-muted">Video Files</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Recent Activities</h5>
            <button className="btn btn-sm btn-outline-secondary">View All</button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light">
                  <tr>
                    <th>Event</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.activities.length > 0 ? (
                    recentActivities.activities.map((activity, index) => (
                      <tr key={index}>
                        <td>
                          <div className="d-flex align-items-center">
                              <i className={`bi ${activity.icon} me-2`}></i>
                              <p className="fw-bold mb-1">{activity.event}</p>
                          </div>
                        </td>
                        <td>
                        <p className="text-muted mb-1">{activity.description}</p>
                        </td>
                        <td>
                          <span className={`badge bg-${activity.status === 'success' ? 'success' : 'danger'}`}>
                            {activity.status}
                          </span>
                        </td>
                        <td>
                          <small className="text-muted">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </small>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        <div className="text-muted">No recent activities found</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
