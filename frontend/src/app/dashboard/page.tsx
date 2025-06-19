'use client';

// Metadata is now defined in the layout.tsx file for this route

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatDistanceToNow } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrochip, 
  faMemory, 
  faHdd, 
  faMusic, 
  faVideo, 
  faDownload, 
  faUpload,
  faEye
} from '@fortawesome/free-solid-svg-icons';
import DashboardService from '@/services/dashboardService';
import { 
  StorageInfo,
  StreamStats,
  SystemMetrics,
  RecentActivities
} from '@/services/dashboardService';
import styles from './dashboard.module.css';
import { useConfig } from '@/hooks/useConfig';

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
    total: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivities>({
    activities: [],
    success: false,
  });

  const config = useConfig();

  // Format bytes to human readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format network speed with appropriate units (Mbps, Gbps)
  // Note: Backend sends values in Mbps
  const formatNetworkSpeed = (mbps: number) => {
    if (mbps < 1000) {
      return `${mbps.toFixed(2)} Mbps`;
    } else {
      return `${(mbps / 1000).toFixed(2)} Gbps`;
    }
  };

  // Update system metrics from WebSocket
  const updateSystemMetrics = useCallback((metrics: SystemMetrics) => {
    setStats(prev => ({
      ...prev,
      cpu: metrics.cpu,
      memory: metrics.memory,
      download: metrics.download,
      upload: metrics.upload,
      ramTotal: metrics.ramTotal,
      ramUsed: metrics.ramUsed
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

    DashboardService.connectWebSocket(config?.config?.apiUrl || '', (metrics: SystemMetrics) => {
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

    return () => {
      DashboardService.disconnectWebSocket();
    };
  }, [status, router, config?.config?.apiUrl, updateSystemMetrics]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatNetworkSpeed(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 6,
          color: '#6b7280'
        }
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)'
        },
        ticks: {
          color: '#6b7280',
          callback: function(value: any) {
            return formatNetworkSpeed(Number(value));
          }
        }
      }
    },
    elements: {
      line: {
        tension: 0.4
      },
      point: {
        radius: 0,
        hoverRadius: 6
      }
    }
  };

  const chartData = {
    labels: networkData.labels,
    datasets: [
      {
        label: 'Download',
        data: networkData.download,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        borderWidth: 2
      },
      {
        label: 'Upload',
        data: networkData.upload,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        borderWidth: 2
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {session.user?.name || 'User'}! Here's what's happening with your streams.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last updated</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* CPU Usage */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-3xl font-bold text-gray-900">{stats.cpu.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faMicrochip} className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(stats.cpu, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Memory</p>
                <p className="text-3xl font-bold text-gray-900">{stats.memory.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatBytes(stats.ramUsed)} / {formatBytes(stats.ramTotal)}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faMemory} className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(stats.memory, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Network Download */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Download</p>
                <p className="text-3xl font-bold text-gray-900">{formatNetworkSpeed(stats.download)}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faDownload} className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Network Upload */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upload</p>
                <p className="text-3xl font-bold text-gray-900">{formatNetworkSpeed(stats.upload)}</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faUpload} className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Storage Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Network Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Network Activity</h3>
              <p className="text-sm text-gray-600">Real-time network usage</p>
            </div>
            <div className="p-6">
              <div className="h-80">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* Storage Info */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Storage</h3>
              <p className="text-sm text-gray-600">Disk usage overview</p>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <FontAwesomeIcon icon={faHdd} className="h-8 w-8 text-gray-600" />
                </div>
                <h4 className="text-2xl font-bold text-gray-900">{formatBytes(storageInfo.used)}</h4>
                <p className="text-sm text-gray-600">of {formatBytes(storageInfo.total)} used</p>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Storage Usage</span>
                  <span>{(storageInfo.used_percent || 0).toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(storageInfo.used_percent || 0).toFixed(2)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <FontAwesomeIcon icon={faMusic} className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h6 className="text-lg font-semibold text-gray-900">{storageInfo.fileCounts.audio}</h6>
                      <p className="text-xs text-gray-500">Audio Files</p>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <FontAwesomeIcon icon={faVideo} className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h6 className="text-lg font-semibold text-gray-900">{storageInfo.fileCounts.videos}</h6>
                      <p className="text-xs text-gray-500">Video Files</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              <FontAwesomeIcon icon={faEye} className="h-4 w-4 mr-2" />
              View All
            </button>
          </div>
          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentActivities.activities.length > 0 ? (
                    recentActivities.activities.map((activity, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FontAwesomeIcon icon={faVideo} className="h-4 w-4 text-gray-400 mr-3" />
                            <p className="text-sm font-medium text-gray-900">{activity.event}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-500">{activity.description}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            activity.status === 'success' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {activity.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </p>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="text-gray-500">No recent activities found</div>
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
