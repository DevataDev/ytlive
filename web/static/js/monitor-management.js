async function fetchMonitors() {
    const jwtToken = localStorage.getItem('jwt_token');
    const res = await fetch('/api/monitors', {
        headers: { 'Authorization': 'Bearer ' + jwtToken }
    });
    const data = await res.json();
    const tbody = document.querySelector('#monitor-table tbody');
    tbody.innerHTML = '';
    if (data.monitors) {
        document.getElementById('countMonitor').textContent = data.monitors.length;
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
                    <button class="btn btn-outline-danger btn-sm" onclick="removeMonitor('${monitor.ID}')">Remove</button>
                </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        // Attach event listeners for save buttons
        document.querySelectorAll('.save-rtmp-url-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                const input = document.getElementById(`rtmp-url-${id}`);
                const newUrl = input.value;
                await updateMonitorRTMPUrl(id, newUrl);
            });
        });
        document.querySelectorAll('.save-stream-key-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                const input = document.getElementById(`stream-key-${id}`);
                const newKey = input.value;
                await updateMonitorStreamKey(id, newKey);
            });
        });
    } else {
        document.getElementById('countMonitor').textContent = '0';
    }
}

async function updateMonitorRTMPUrl(id, rtmpUrl) {
    const jwtToken = localStorage.getItem('jwt_token');
    await fetch(`/api/monitors/${id}/rtmp-url`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
        body: JSON.stringify({ rtmp_url: rtmpUrl })
    });
    fetchMonitors();
}

async function updateMonitorStreamKey(id, streamKey) {
    const jwtToken = localStorage.getItem('jwt_token');
    await fetch(`/api/monitors/${id}/stream-key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
        body: JSON.stringify({ stream_key: streamKey })
    });
    fetchMonitors();
}

async function removeMonitor(uniqueId) {
    if (!confirm('Remove this monitor?')) return;
    const jwtToken = localStorage.getItem('jwt_token');
    await fetch('/api/monitors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
        body: JSON.stringify({ "unique_id": uniqueId })
    });
    fetchMonitors();
}

let selectedMonitorId = null;

function initMonitor() {
    document.getElementById('add-monitor-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const uniqueId = document.getElementById('uniqueId').value;
        const jwtToken = localStorage.getItem('jwt_token');
        await fetch('/api/monitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
            body: JSON.stringify({ "unique_id": uniqueId })
        });
        document.getElementById('uniqueId').value = '';
        fetchMonitors();
    });
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
            } else {
                $('#channelSelect').append('<option value="">No channels found</option>');
            }
            $('#streamSelect').empty();
        },
        error: function() {
            $('#channelSelect').append('<option value="">Failed to load channels</option>');
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
            } else {
                $('#streamSelect').append('<option value="">No live streams found</option>');
            }
        },
        error: function() {
            $('#streamSelect').append('<option value="">Failed to load streams</option>');
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

