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
                    <button class="btn btn-outline-danger btn-sm" onclick="removeMonitor('${monitor.ID}')">Remove</button>
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

