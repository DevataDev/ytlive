// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let totalMonitors = 0;

// Initialize pagination event listeners
function initPagination() {
    // First page button
    document.getElementById('firstPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage = 1;
            fetchMonitors();
        }
    });

    // Previous page button
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchMonitors();
        }
    });

    // Next page button
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const maxPage = Math.ceil(totalMonitors / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            fetchMonitors();
        }
    });

    // Last page button
    document.getElementById('lastPage')?.addEventListener('click', () => {
        const maxPage = Math.ceil(totalMonitors / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage = maxPage;
            fetchMonitors();
        }
    });
}

async function fetchMonitors() {
    const jwtToken = localStorage.getItem('jwt_token');
    const offset = (currentPage - 1) * itemsPerPage;
    
    try {
        const res = await fetch(`/api/monitors?limit=${itemsPerPage}&offset=${offset}`, {
            headers: { 'Authorization': 'Bearer ' + jwtToken }
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch monitors');
        }
        
        const data = await res.json();
        const tbody = document.querySelector('#monitor-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Update total count
        totalMonitors = data.pagination.total || data.monitors?.length || 0;
        const countMonitorEl = document.getElementById('countMonitor');
        if (countMonitorEl) {
            countMonitorEl.textContent = totalMonitors;
        }
        
        // Update pagination UI
        updatePaginationUI();
        
        if (data.monitors && data.monitors.length > 0) {
            data.monitors.forEach(monitor => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="monitor-title-ellipsis" title="${monitor.UniqueId}">${monitor.UniqueId}</span></td>
                    <td>
                        <div class="input-group input-group-sm">
                            <input type="text" class="form-control monitor-rtmp-url" id="rtmp-url-${monitor.ID}" value="${monitor.RtmpUrl || ''}" />
                            <button class="btn btn-outline-primary save-rtmp-url-btn" data-id="${monitor.ID}" title="Save RTMP URL"><i class="fa fa-save"></i></button>
                        </div>
                    </td>
                    <td>
                        <div class="input-group input-group-sm">
                            <input type="text" class="form-control monitor-stream-key" id="stream-key-${monitor.ID}" value="${monitor.StreamKey || ''}" />
                            <button class="btn btn-outline-primary save-stream-key-btn" data-id="${monitor.ID}" title="Save Stream Key"><i class="fa fa-save"></i></button>
                        </div>
                    </td>
                    <td>${monitor.IsLive ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-outline-primary btn-sm bind-channel-btn" data-id="${monitor.ID}">Bind</button>
                            <button class="btn btn-outline-danger btn-sm" onclick="handleDeleteClick('${monitor.UniqueId}', '${monitor.UniqueId}')">Remove</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            // Attach event listeners for save buttons
            attachEventListeners();
        } else {
            tbody.innerHTML = `
                <tr class="fade-in">
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-inbox display-6 d-block mb-2"></i>
                        <span>No monitors found. Add one to get started.</span>
                    </td>
                </tr>`;
        }
    } catch (error) {
        console.error('Error fetching monitors:', error);
        showMonitorToast('Failed to load monitors. Please try again.', 'danger');
    }
}

async function updateMonitorRTMPUrl(id, rtmpUrl) {
    try {
        const jwtToken = localStorage.getItem('jwt_token');
        const response = await fetch(`/api/monitors/${id}/rtmp-url`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ' + jwtToken 
            },
            body: JSON.stringify({ rtmp_url: rtmpUrl })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update RTMP URL');
        }
        
        await fetchMonitors();
        showMonitorToast('RTMP URL updated successfully', 'success');
    } catch (error) {
        console.error('Error updating RTMP URL:', error);
        showMonitorToast(error.message, 'danger');
    }
}

async function updateMonitorStreamKey(id, streamKey) {
    try {
        const jwtToken = localStorage.getItem('jwt_token');
        const response = await fetch(`/api/monitors/${id}/stream-key`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ' + jwtToken 
            },
            body: JSON.stringify({ stream_key: streamKey })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update stream key');
        }
        
        await fetchMonitors();
        showMonitorToast('Stream key updated successfully', 'success');
    } catch (error) {
        console.error('Error updating stream key:', error);
        showMonitorToast(error.message, 'danger');
    }
}

// Track which monitor is being deleted
let monitorToDelete = null;
const deleteMonitorModal = new bootstrap.Modal(document.getElementById('deleteMonitorModal'));

// Handle delete button click
function handleDeleteClick(uniqueId, displayName) {
    monitorToDelete = uniqueId;
    // Update modal content
    document.getElementById('deleteMonitorId').textContent = displayName || uniqueId;
    // Show the modal
    deleteMonitorModal.show();
}

// Handle confirm delete button click
document.getElementById('confirmDeleteMonitor').addEventListener('click', async function() {
    if (!monitorToDelete) return;
    
    const deleteBtn = this;
    const originalText = deleteBtn.innerHTML;
    
    // Show loading state
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Removing...';
    
    try {
        const jwtToken = localStorage.getItem('jwt_token');
        const response = await fetch('/api/monitors', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
            body: JSON.stringify({ "unique_id": monitorToDelete })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete monitor');
        }
        
        // Close the modal and refresh the list
        deleteMonitorModal.hide();
        fetchMonitors();
        showMonitorToast('Monitor removed successfully', 'success');
    } catch (error) {
        console.error('Error removing monitor:', error);
        showMonitorToast(error.message, 'danger');
    } finally {
        // Reset button state
        deleteBtn.innerHTML = originalText;
        deleteBtn.disabled = false;
        monitorToDelete = null;
    }
});

// Reset modal when hidden
document.getElementById('deleteMonitorModal').addEventListener('hidden.bs.modal', function () {
    monitorToDelete = null;
    document.getElementById('deleteMonitorId').textContent = '';
});

let selectedMonitorId = null;

// Update pagination UI controls
function updatePaginationUI() {
    const firstBtn = document.getElementById('firstPage');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const lastBtn = document.getElementById('lastPage');
    const currentPageEl = document.getElementById('currentPage');
    const showingStartEl = document.getElementById('showingStart');
    const showingEndEl = document.getElementById('showingEnd');
    const totalCountEl = document.getElementById('totalCount');
    const pageSizeInfoEl = document.getElementById('pageSizeInfo');

    const maxPage = Math.ceil(totalMonitors / itemsPerPage) || 1;
    
    // Update button states
    if (firstBtn) firstBtn.disabled = currentPage === 1;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= maxPage;
    if (lastBtn) lastBtn.disabled = currentPage >= maxPage;
    
    // Update current page display
    if (currentPageEl) currentPageEl.textContent = `${currentPage} of ${maxPage}`;
    
    // Update item counts
    const start = Math.min((currentPage - 1) * itemsPerPage + 1, totalMonitors) || 0;
    const end = Math.min(currentPage * itemsPerPage, totalMonitors) || 0;
    
    if (showingStartEl) showingStartEl.textContent = start;
    if (showingEndEl) showingEndEl.textContent = end;
    if (totalCountEl) totalCountEl.textContent = totalMonitors;
    if (pageSizeInfoEl) pageSizeInfoEl.textContent = itemsPerPage;
    
    // Update button active states
    document.querySelectorAll('.page-item').forEach(item => item.classList.remove('active'));
    const currentPageItem = document.querySelector(`.page-item[data-page="${currentPage}"]`);
    if (currentPageItem) {
        currentPageItem.classList.add('active');
    }
}

// Attach event listeners to monitor elements
function attachEventListeners() {
    // Save RTMP URL buttons
    document.querySelectorAll('.save-rtmp-url-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const input = document.getElementById(`rtmp-url-${id}`);
            const newUrl = input.value;
            await updateMonitorRTMPUrl(id, newUrl);
        });
    });
    
    // Save Stream Key buttons
    document.querySelectorAll('.save-stream-key-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const input = document.getElementById(`stream-key-${id}`);
            const newKey = input.value;
            await updateMonitorStreamKey(id, newKey);
        });
    });
}

function initMonitor() {
    // Initialize pagination
    initPagination();
    
    // Add monitor form submission
    document.getElementById('add-monitor-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const uniqueId = document.getElementById('uniqueId').value.trim();
        if (!uniqueId) return;
        
        const addBtn = this.querySelector('button[type="submit"]');
        const originalText = addBtn.innerHTML;
        
        try {
            // Show loading state
            addBtn.disabled = true;
            addBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Adding...';
            
            const jwtToken = localStorage.getItem('jwt_token');
            const response = await fetch('/api/monitors', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': 'Bearer ' + jwtToken 
                },
                body: JSON.stringify({ "unique_id": uniqueId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add monitor');
            }
            
            // Reset form and refresh the list
            document.getElementById('uniqueId').value = '';
            currentPage = 1; // Reset to first page when adding new monitor
            await fetchMonitors();
            showMonitorToast('Monitor added successfully', 'success');
        } catch (error) {
            console.error('Error adding monitor:', error);
            showMonitorToast(error.message, 'danger');
        } finally {
            addBtn.innerHTML = originalText;
            addBtn.disabled = false;
        }
    });
    
    // Initial fetch
    fetchMonitors();
}

function updateMonitorIsLiveBadge(uniqueId, isLive) {
    const badge = document.querySelector(`#monitor-table tr[data-monitor-id="monitor-${uniqueId}"] td:nth-child(4) .badge`);
    if (isLive) {
        badge.textContent = 'Yes';
        badge.classList.remove('bg-secondary');
        badge.classList.add('bg-success');
    } else {
        badge.textContent = 'No';
        badge.classList.remove('bg-success');
        badge.classList.add('bg-secondary');
    }
}

function startWebsockerForBroadcastMonitoring() {
    if (window.broadcastMonitoringSocket) {
        window.broadcastMonitoringSocket.close();
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem("jwt_token");
    const wsUrl = protocol + '://' + window.location.host + '/ws?token=' + encodeURIComponent(token);
    window.broadcastMonitoringSocket = new WebSocket(wsUrl);
    window.broadcastMonitoringSocket.onmessage = function(event) {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'refresh_monitor' && msg.unique_id) {
                const rows = $(`#monitor-table tbody tr`);
                rows.each(function() {
                    const uniqueId = $(this).data("monitor-id");
                    if (uniqueId == msg.unique_id || uniqueId == msg.id) {
                        updateMonitorIsLiveBadge(uniqueId, msg.is_live);
                    }
                });
            }
        } catch(e) {}
    };
    window.broadcastMonitoringSocket.onclose = function() {
        // Try to reconnect after 2s
        setTimeout(startWebsockerForBroadcastMonitoring, 2000);
    };
}   


function showMonitorToast(message, type) {
    const toast = document.getElementById('monitorToast');
    const toastBody = document.getElementById('monitorToastBody');
    toastBody.textContent = message;
    toast.classList.remove('text-bg-danger', 'text-bg-success');
    if (type === 'success') {
        toast.classList.add('text-bg-success');
    } else {
        toast.classList.add('text-bg-danger');
    }
    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toast);
    toastBootstrap.show();
}

// --- Bind Channels Logic ---
let selectedStreamId = null;
$(document).on('click', '.bind-channel-btn', function() {
    selectedStreamId = $(this).data('id');
    $('#bindChannelModal').modal('show');
    $('#channelSelect').empty();
    $('#streamSelect').empty();
    // Fetch channels
    const token = localStorage.getItem('jwt_token');
    $.ajax({
        url: '/api/youtube/list-channels',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        success: function(res) {
            if (res.channels && res.channels.length > 0) {
                $('#channelSelect').append('<option value="">Select a channel</option>');
                res.channels.forEach(function(ch) {
                    $('#channelSelect').append(`<option value="${ch.ID}">${ch.ChannelName}</option>`);
                });
                //enabled the streamSelect
                $('#streamSelect').prop('disabled', false);
            } else {
                $('#channelSelect').append('<option value="">No channels found</option>');
                //disabled the streamSelect
                $('#streamSelect').prop('disabled', true);
            }
            $('#streamSelect').empty();
        },
        error: function() {
            $('#channelSelect').append('<option value="">Failed to load channels</option>');
            //disabled the streamSelect
            $('#streamSelect').prop('disabled', true);
        }
    });
});
// When channel is selected, fetch live streams for that channel
$('#channelSelect').on('change', function() {
    const channelId = $(this).val();
    $('#streamSelect').empty();
    if (!channelId) return;
    const token = localStorage.getItem('jwt_token');
    $.ajax({
        url: `/api/youtube/channel/${channelId}/streams`,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        success: function(res) {
            if (res.streams && res.streams.length > 0) {
                $('#streamSelect').append('<option value="">Select a live stream</option>');
                res.streams.forEach(function(stream) {
                    $('#streamSelect').append(`<option value="${stream.stream_key}">${stream.title} - ${stream.stream_key}</option>`);
                });
                //enabled the streamSelect
                $('#streamSelect').prop('disabled', false);
            } else {
                $('#streamSelect').append('<option value="">No live streams found</option>');
                //disabled the streamSelect
                $('#streamSelect').prop('disabled', true);
            }
        },
        error: function() {
            $('#streamSelect').append('<option value="">Failed to load streams</option>');
            //disabled the streamSelect
            $('#streamSelect').prop('disabled', true);
        }
    });
});
// Bind button
$('#bindChannelSaveBtn').on('click', function() {
    const channelId = $('#channelSelect').val();
    const liveStreamId = $('#streamSelect').val();
    if (!selectedStreamId || !channelId || !liveStreamId) {
        alert('Please select both channel and live stream.');
        return;
    }
    const token = localStorage.getItem('jwt_token');
    $.ajax({
        url: `/api/monitors/${selectedStreamId}/channel-id`,
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token },
        contentType: 'application/json',
        data: JSON.stringify({ channel_id: channelId, stream_key: liveStreamId }),
        success: function() {
            $('#bindChannelModal').modal('hide');
            showMonitorToast('Channel bound successfully!', 'success');
            fetchMonitors();
        },
        error: function() {
            showMonitorToast('Failed to bind channel.', 'error');
        }
    });
});
// --- End Bind Channels Logic ---

