$(function() {
    // --- FFmpeg Logs Modal Logic ---
    let ffmpegLogsSocket = null;
    $(document).on('click', '.view-logs-btn', function() {
        const mirrorId = $(this).data('id');
        const $modal = $('#ffmpegLogsModal');
        const $content = $('#ffmpegLogsContent');
        $content.text('Loading logs...');
        $modal.modal('show');

        // Close previous socket if any
        if (ffmpegLogsSocket) {
            ffmpegLogsSocket.close();
            ffmpegLogsSocket = null;
        }
        // Try WebSocket first
        let protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        let token = localStorage.getItem("jwt_token");
        let wsUrl = protocol + '://' + window.location.host + `/ws/ffmpeg-logs/mirror/${mirrorId}?token=${encodeURIComponent(token)}`;
        try {
            ffmpegLogsSocket = new WebSocket(wsUrl);
            ffmpegLogsSocket.onopen = function() {
                $content.text('');
            };
            ffmpegLogsSocket.onmessage = function(event) {
                $content.append(event.data + '\n');
                $content.scrollTop($content[0].scrollHeight);
            };
            ffmpegLogsSocket.onerror = function() {
                // fallback to HTTP fetch
                fetch(`/api/mirrors/${mirrorId}/logs`, {
                    headers: {
                        Authorization: "Bearer " + token
                    }
                })
                    .then(resp => resp.text())
                    .then(text => {
                        $content.text(text);
                        $content.scrollTop($content[0].scrollHeight);
                    })
                    .catch(() => {
                        $content.text('Failed to load logs.');
                    });
            };
            ffmpegLogsSocket.onclose = function() {
                ffmpegLogsSocket = null;
            };
        } catch (e) {
            // fallback to HTTP fetch
            fetch(`/api/mirrors/${mirrorId}/logs`)
                .then(resp => resp.text())
                .then(text => {
                    $content.text(text);
                    $content.scrollTop($content[0].scrollHeight);
                })
                .catch(() => {
                    $content.text('Failed to load logs.');
                });
        }
        // Close socket when modal hidden
        $modal.off('hidden.bs.modal').on('hidden.bs.modal', function() {
            if (ffmpegLogsSocket) {
                ffmpegLogsSocket.close();
                ffmpegLogsSocket = null;
            }
        });
    });
    // Auth check and logout
    if (!localStorage.getItem("jwt_token")) {
        window.location.href = "/";
        return;
    }
    $("#logoutBtn").click(function() {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout");
        window.location.href = "/";
    });

    function fetchMirrors() {
        const token = localStorage.getItem("jwt_token");
        $.ajax({
            url: '/api/mirrors',
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            success: function(data) {
                $("#countMirror").text(data.mirrors ? data.mirrors.length : 0);
                renderMirrorsTable(data.mirrors || []);
            },
            error: function() {
                $("#mirror-list-cards").html('<div class="col-12 text-center text-danger">Failed to load mirrors.</div>');
            }
        });
    }

    function renderMirrorsTable(mirrors) {
        const cardContainer = $("#mirror-list-cards");
        cardContainer.empty();
        if (!mirrors || mirrors.length === 0) {
            cardContainer.append('<div class="col-12 text-center text-muted">No mirrors found.</div>');
            return;
        }
        mirrors.forEach(mirror => {
            let status = (mirror.Status || '').toLowerCase();
            let isLive = status === 'live';
            let isQueued = status === 'queued';
            let canStart = mirror.IsAlive && mirror.StreamKey && !isLive;
            let aliveBadge = mirror.IsAlive ? '<span class="badge bg-success">Tiktok Host Online</span>' : `<span class="badge bg-secondary text-capitalize">Offline</span>`;
            let toggleBtn = isLive
                ? `<button class="btn btn-danger btn-sm mirror-toggle w-100" data-id="${mirror.ID}" data-action="stop">Stop</button>`
                : isQueued
                ? `<button class="btn btn-warning btn-sm mirror-toggle w-100" data-id="${mirror.ID}" data-action="start" disabled>Queued</button>`
                : `<button class="btn btn-success btn-sm mirror-toggle w-100" data-id="${mirror.ID}" data-action="start"${canStart ? '' : ' disabled'}>Start</button>`;
            let streamKeyField = `<input type="password" class="form-control form-control-sm mirror-streamkey" id="mirror-streamkey-input-${mirror.ID}" value="${mirror.StreamKey || ''}" style="max-width:180px;display:inline-block;">`;
            let streamKeySaveBtn = `<button class="btn btn-outline-success btn-sm ms-1 mirror-streamkey-save" data-id="${mirror.ID}" title="Save Stream Key"><i class="fa fa-save"></i></button>`;
            let showPasswordBtn = `<button class="btn btn-outline-secondary btn-sm ms-1 mirror-password-toggle" title="Show/Hide"><i class="fa fa-eye"></i></button>`;
            let rtmpInputGroup = `
                <div class="input-group input-group-sm">
                  <input type="text" class="form-control mirror-rtmp-url" id="mirror-rtmpurl-input-${mirror.ID}" value="${mirror.RtmpUrl || ''}" placeholder="RTMP URL" />
                  <button class="btn btn-outline-success mirror-rtmpurl-save" data-id="${mirror.ID}" title="Save RTMP URL"><i class="fa fa-save"></i></button>
                </div>`;
            let bindBtn = `<button class='btn btn-outline-primary btn-sm w-100 mt-2 bind-channel-btn' data-id='${mirror.ID}'>Bind</button>`;
            let deleteBtn = `<button class="btn btn-outline-danger btn-sm mirror-delete w-100 mt-2" data-id="${mirror.ID}"><i class="fa fa-trash"></i> Delete</button>`;
            let logsBtn = `<button class="btn btn-outline-info btn-sm view-logs-btn w-100 mt-2 mirror-logs" data-id="${mirror.ID}"><i class="fa fa-info-circle"></i> Logs</button>`;
            // Use video.js + hls.js + flv.js for preview
            // let videoPlayer = `
            //     <video id="mirror-video-${mirror.ID}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
            //     <script>window._mirrorHlsPlayers = window._mirrorHlsPlayers || {}; setTimeout(function() { try { if (window._mirrorHlsPlayers['${mirror.ID}']) { window._mirrorHlsPlayers['${mirror.ID}'].dispose && window._mirrorHlsPlayers['${mirror.ID}'].dispose(); delete window._mirrorHlsPlayers['${mirror.ID}']; } var video = document.getElementById('mirror-video-${mirror.ID}'); if (video) { var url = '${mirror.LiveUrl}'; if (url.endsWith('.m3u8') && window.Hls && Hls.isSupported()) { var hls = new Hls(); hls.loadSource(url); hls.attachMedia(video); window._mirrorHlsPlayers['${mirror.ID}'] = hls; } else if (url.endsWith('.flv') && window.flvjs && flvjs.isSupported()) { var flvPlayer = flvjs.createPlayer({ type: 'flv', url: url }); flvPlayer.attachMediaElement(video); flvPlayer.load(); window._mirrorHlsPlayers['${mirror.ID}'] = flvPlayer; } else { video.src = url; videojs(video); } } } catch(e){} }, 100);</script>
            // `;
            // use flv.js for preview
            let videoPlayer;
            if (mirror.LiveUrl && mirror.LiveUrl.includes('.flv?')) {
                videoPlayer = `
                    <video id="mirror-video-${mirror.ID}" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                    <script>
                        window._mirrorFlvPlayers = window._mirrorFlvPlayers || {};
                        setTimeout(function() {
                            try {
                                if (window._mirrorFlvPlayers['${mirror.ID}']) {
                                    window._mirrorFlvPlayers['${mirror.ID}'].destroy();
                                    delete window._mirrorFlvPlayers['${mirror.ID}'];
                                }
                                var video = document.getElementById('mirror-video-${mirror.ID}');
                                if (video && window.flvjs && flvjs.isSupported()) {
                                    var flvPlayer = flvjs.createPlayer({ type: 'flv', url: '${mirror.LiveUrl}', "isLive": true });
                                    flvPlayer.attachMediaElement(video);
                                    flvPlayer.load();
                                    window._mirrorFlvPlayers['${mirror.ID}'] = flvPlayer;
                                }
                            } catch(e){}
                        }, 100);
                    </script>
                `;
            } else if (mirror.LiveUrl && mirror.LiveUrl.includes('.m3u8')) {
                videoPlayer = `
                <video id="mirror-video-${mirror.ID}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                <script>
                    window._mirrorHlsPlayers = window._mirrorHlsPlayers || {};
                    setTimeout(function() {
                        try {
                            if (window._mirrorHlsPlayers['${mirror.ID}']) {
                                window._mirrorHlsPlayers['${mirror.ID}'].destroy && window._mirrorHlsPlayers['${mirror.ID}'].destroy();
                                delete window._mirrorHlsPlayers['${mirror.ID}'];
                            }
                            var video = document.getElementById('mirror-video-${mirror.ID}');
                            if (video && window.Hls && Hls.isSupported()) {
                                var hls = new Hls();
                                hls.loadSource('${mirror.LiveUrl}');
                                hls.attachMedia(video);
                                window._mirrorHlsPlayers['${mirror.ID}'] = hls;
                            } else if (video) {
                                video.src = '${mirror.LiveUrl}';
                                videojs(video);
                            }
                        } catch(e){}
                    }, 100);
                </script>
            `;
            } else {
                videoPlayer = `<video id="mirror-video-${mirror.ID}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                <script>
                    setTimeout(function() {
                        try {
                            var video = document.getElementById('mirror-video-${mirror.ID}');
                            if (video) {
                                video.src = '${mirror.LiveUrl || ''}';
                                videojs(video);
                            }
                        } catch(e){}
                    }, 100);
                </script>`;
            }
            cardContainer.append(`
                <div class="col-md-4">
                    <div class="card stream-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-2">
                                <span class="fw-bold fs-5 mirror-title-ellipsis" title="${mirror.DisplayName || ''}">${mirror.DisplayName || ''}</span>
                            </div>
                            <div class="mb-2">
                                ${videoPlayer}
                            </div>
                            <div class="mb-2">
                                ${aliveBadge}
                            </div>
                            <div class="mb-2">
                                Room ID: <span class="text-truncate">${mirror.RoomId || ''}</span>
                            </div>
                            <div class="mb-2">
                                <label class="form-label mb-0">Stream Key:</label>
                                ${streamKeyField}${streamKeySaveBtn}${showPasswordBtn}
                            </div>
                            <div class="mb-2">
                                <label class="form-label mb-0">RTMP URL:</label>
                                ${rtmpInputGroup}
                            </div>
                            <div class="mb-2 mt-3">
                                ${toggleBtn}
                                ${deleteBtn}
                                ${logsBtn}
                                ${bindBtn}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        });
    }

    // Handler for Start/Stop toggle button
    $(document).on("click", ".mirror-toggle", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const action = $(this).data("action");
        if (action === 'start') {
            $.ajax({
                url: `/api/mirrors/${id}/start`,
                type: 'POST',
                headers: { Authorization: 'Bearer ' + localStorage.getItem("jwt_token") },
                success: function() {
                    fetchMirrors();
                    showSnackbar("Mirror started successfully.", false);
                },
                error: function(xhr) {
                    showSnackbar("Failed to start mirror: " + (xhr.responseText || xhr.statusText), true);
                }
            });
        } else if (action === 'stop') {
            $.ajax({
                url: `/api/mirrors/${id}/stop`,
                type: 'POST',
                headers: { Authorization: 'Bearer ' + localStorage.getItem("jwt_token") },
                success: function() {
                    fetchMirrors();
                    showSnackbar("Mirror stopped successfully.", false);
                },
                error: function(xhr) {
                    showSnackbar("Failed to stop mirror: " + (xhr.responseText || xhr.statusText), true);
                }
            });
        }
    });

    // Handler for Delete button
    $(document).on("click", ".mirror-delete", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        if (!confirm("Are you sure you want to delete this mirror?")) return;
        $.ajax({
            url: `/api/mirrors/${id}`,
            type: 'DELETE',
            headers: { Authorization: 'Bearer ' + localStorage.getItem("jwt_token") },
            success: function() {
                fetchMirrors();
                showSnackbar("Mirror deleted successfully.", false);
            },
            error: function(xhr) {
                showSnackbar("Failed to delete mirror: " + (xhr.responseText || xhr.statusText), true);
            }
        });
    });

    // Snackbar notification helper
    function showSnackbar(message, isError) {
        const toastEl = document.getElementById('streamToast');
        const toastBody = document.getElementById('streamToastBody');
        if (!toastEl || !toastBody) return;
        toastBody.textContent = message;
        toastEl.classList.remove('text-bg-danger', 'text-bg-success');
        if (!isError) {
            toastEl.classList.add('text-bg-success');
        } else {
            toastEl.classList.add('text-bg-danger');
        }
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    // Handler for RTMP URL save
    $(document).on("click", ".mirror-rtmpurl-save", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const newUrl = $(`#mirror-rtmpurl-input-${id}`).val();
        $.ajax({
            url: `/api/mirrors/${id}/rtmp-url`,
            type: 'PUT',
            contentType: 'application/json',
            headers: { Authorization: 'Bearer ' + localStorage.getItem("jwt_token") },
            data: JSON.stringify({ rtmp_url: newUrl }),
            success: function() {
                showSnackbar("RTMP URL saved successfully.", false);
                fetchMirrors();
            },
            error: function(xhr) {
                showSnackbar("Failed to save RTMP URL: " + (xhr.responseText || xhr.statusText), true);
            }
        });
    });

    // Handler for Stream Key save
    $(document).on("click", ".mirror-streamkey-save", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const newKey = $(`#mirror-streamkey-input-${id}`).val();
        $.ajax({
            url: `/api/mirrors/${id}/stream-key`,
            type: 'PUT',
            contentType: 'application/json',
            headers: { Authorization: 'Bearer ' + localStorage.getItem("jwt_token") },
            data: JSON.stringify({ stream_key: newKey }),
            success: function() {
                showSnackbar("Stream Key saved successfully.", false);
                fetchMirrors();
            },
            error: function(xhr) {
                showSnackbar("Failed to save Stream Key: " + (xhr.responseText || xhr.statusText), true);
            }
        });
    });

    // Password show/hide toggle
    $(document).on("click", ".mirror-password-toggle", function() {
        const input = $(this).siblings('input');
        const type = input.attr('type') === 'password' ? 'text' : 'password';
        input.attr('type', type);
        $(this).find('i').toggleClass('fa-eye fa-eye-slash');
    });

    // Handle Add Mirror button (modal is auto-handled by Bootstrap)
    $("#addMirrorForm").on("submit", function(e) {
        e.preventDefault();
        const input = $("#mirrorInput").val().trim();
        if (!input) {
            $("#mirrorInput").addClass("is-invalid");
            return;
        }
        $("#mirrorInput").removeClass("is-invalid");
        const token = localStorage.getItem("jwt_token");
        $("#addMirrorModal .btn-primary").prop("disabled", true);
        // show loading spinner
        $("#addMirrorModal .btn-primary").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...');
        $.ajax({
            url: '/api/mirrors',
            method: 'POST',
            contentType: 'application/json',
            headers: { Authorization: 'Bearer ' + token },
            data: JSON.stringify({ tiktok: input }),
            success: function(resp) {
                $('#addMirrorModal').modal('hide');
                $("#mirrorInput").val("");
                $("#addMirrorModal .btn-primary").prop("disabled", false);
                $("#addMirrorModal .btn-primary").html('Add Mirror');
                showSnackbar("Mirror added successfully.", false);
                fetchMirrors();
            },
            error: function(xhr) {
                let msg = 'Failed to add mirror.';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                showSnackbar(msg, true);
                $("#addMirrorModal .btn-primary").prop("disabled", false);
                $("#addMirrorModal .btn-primary").html('Add Mirror');
            },
            complete: function() {
                $("#addMirrorForm button[type='submit']").prop("disabled", false);
            }
        });
    });

    // --- Bind Channels Logic ---
    let selectedMirrorId = null;
    $(document).on('click', '.bind-channel-btn', function() {
        selectedMirrorId = $(this).data('id');
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
        if (!selectedMirrorId || !channelId || !liveStreamId) {
            alert('Please select both channel and live stream.');
            return;
        }
        const token = localStorage.getItem('jwt_token');
        $.ajax({
            url: `/api/mirrors/${selectedMirrorId}/channel-id`,
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token },
            contentType: 'application/json',
            data: JSON.stringify({ channel_id: channelId, stream_key: liveStreamId }),
            success: function() {
                $('#bindChannelModal').modal('hide');
                showSnackbar('Channel bound successfully!', false);
                fetchMirrors();
            },
            error: function() {
                alert('Failed to bind channel.');
            }
        });
    });
    // --- End Bind Channels Logic ---
    // Initial load
    fetchMirrors();
});

// --- WebSocket for mirror room is alive updates ---
function setupMirrorRoomIsAliveWebSocket() {
    if (window.mirrorRoomIsAliveSocket) {
        window.mirrorRoomIsAliveSocket.close();
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem("jwt_token");
    const wsUrl = protocol + '://' + window.location.host + '/ws?token=' + encodeURIComponent(token);
    window.mirrorRoomIsAliveSocket = new WebSocket(wsUrl);
    window.mirrorRoomIsAliveSocket.onmessage = function(event) {
        // Expecting a message like { type: 'mirror_room_is_alive_update', is_alive_map: { ... } }
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'mirror_room_is_alive_update') {
                updateMirrorRoomIsAlive(msg.is_alive_map);
            }
            if (msg.type === 'mirror_update_list') {
                fetchMirrors();
            }
        } catch(e) {}
    };
    window.mirrorRoomIsAliveSocket.onclose = function() {
        // Try to reconnect after 2s
        setTimeout(setupMirrorRoomIsAliveWebSocket, 2000);
    };
}
setupMirrorRoomIsAliveWebSocket();

function updateMirrorRoomIsAlive(isAliveMap) {
    const rows = document.querySelectorAll('.mirror-row');
    rows.forEach(row => {
        const roomId = row.getAttribute('data-room-id');
        const isAlive = isAliveMap[roomId];
        const badge = row.querySelector('.mirror-alive-badge');
        if (isAlive) {
            badge.classList.remove('bg-danger');
            badge.classList.add('bg-success');
            badge.textContent = 'Tiktok Host Online';
        } else {
            badge.classList.remove('bg-success');
            badge.classList.add('bg-danger');
            badge.textContent = 'Tiktok Host Offline';
        }
    });
}
