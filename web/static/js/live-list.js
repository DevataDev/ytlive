$(function() {
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

    function fetchLiveFeeds() {
        const token = localStorage.getItem("jwt_token");
        $.ajax({
            url: '/api/tiktok/live-feed',
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            success: function(data) {
                $("#countRoom").text(data.rooms ? data.rooms.length : 0);
                renderLiveFeedsTable(data.rooms || []);
            },
            error: function() {
                $("#room-list-cards").html('<div class="col-12 text-center text-danger">Failed to load rooms.</div>');
            }
        });
    }

    function renderLiveFeedsTable(liveFeeds) {
        const cardContainer = $("#room-list-cards");
        cardContainer.empty();
        if (!liveFeeds || liveFeeds.length === 0) {
            cardContainer.append('<div class="col-12 text-center text-muted">No rooms found.</div>');
            return;
        }
        liveFeeds.forEach(liveFeed => {
            let canStart = false;
            let isLive = false;
            let aliveBadge = '<span class="badge bg-success">Tiktok Host Online</span>';
            let addToMirrorBtn = `<button class="btn btn-success btn-sm live-add-mirror w-100" data-id="${liveFeed.id_str}" data-action="addMirror">Add to Mirror</button>`;
            // Use video.js + hls.js + flv.js for preview
            // let videoPlayer = `
            //     <video id="mirror-video-${mirror.ID}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
            //     <script>window._mirrorHlsPlayers = window._mirrorHlsPlayers || {}; setTimeout(function() { try { if (window._mirrorHlsPlayers['${mirror.ID}']) { window._mirrorHlsPlayers['${mirror.ID}'].dispose && window._mirrorHlsPlayers['${mirror.ID}'].dispose(); delete window._mirrorHlsPlayers['${mirror.ID}']; } var video = document.getElementById('mirror-video-${mirror.ID}'); if (video) { var url = '${mirror.LiveUrl}'; if (url.endsWith('.m3u8') && window.Hls && Hls.isSupported()) { var hls = new Hls(); hls.loadSource(url); hls.attachMedia(video); window._mirrorHlsPlayers['${mirror.ID}'] = hls; } else if (url.endsWith('.flv') && window.flvjs && flvjs.isSupported()) { var flvPlayer = flvjs.createPlayer({ type: 'flv', url: url }); flvPlayer.attachMediaElement(video); flvPlayer.load(); window._mirrorHlsPlayers['${mirror.ID}'] = flvPlayer; } else { video.src = url; videojs(video); } } } catch(e){} }, 100);</script>
            // `;
            // use flv.js for preview
            let videoPlayer;
            let liveUrl = liveFeed.live_url;
            if (liveUrl && liveUrl.includes('.flv?')) {
                videoPlayer = `
                    <video id="live-video-${liveFeed.id}" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                    <script>
                        window._liveFlvPlayers = window._liveFlvPlayers || {};
                        setTimeout(function() {
                            try {
                                if (window._liveFlvPlayers['${liveFeed.id}']) {
                                    window._liveFlvPlayers['${liveFeed.id}'].destroy();
                                    delete window._liveFlvPlayers['${liveFeed.id}'];
                                }
                                var video = document.getElementById('live-video-${liveFeed.id}');
                                if (video && window.flvjs && flvjs.isSupported()) {
                                    var flvPlayer = flvjs.createPlayer({ type: 'flv', url: '${liveUrl}', "isLive": true });
                                    flvPlayer.attachMediaElement(video);
                                    flvPlayer.load();
                                    window._mirrorFlvPlayers['${liveFeed.id}'] = flvPlayer;
                                }
                            } catch(e){}
                        }, 100);
                    </script>
                `;
            } else if (liveUrl && liveUrl.includes('.m3u8')) {
                videoPlayer = `
                <video id="live-video-${liveFeed.id}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                <script>
                    window._liveHlsPlayers = window._liveHlsPlayers || {};
                    setTimeout(function() {
                        try {
                            if (window._liveHlsPlayers['${liveFeed.id}']) {
                                window._liveHlsPlayers['${liveFeed.id}'].destroy && window._liveHlsPlayers['${liveFeed.id}'].destroy();
                                delete window._liveHlsPlayers['${liveFeed.id}'];
                            }
                            var video = document.getElementById('live-video-${liveFeed.id}');
                            if (video && window.Hls && Hls.isSupported()) {
                                var hls = new Hls();
                                hls.loadSource('${liveUrl}');
                                hls.attachMedia(video);
                                window._liveHlsPlayers['${liveFeed.id}'] = hls;
                            } else if (video) {
                                video.src = '${liveUrl}';
                                videojs(video);
                            }
                        } catch(e){}
                    }, 100);
                </script>
            `;
            } else {
                videoPlayer = `<video id="live-video-${liveFeed.id}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                <script>
                    setTimeout(function() {
                        try {
                            var video = document.getElementById('live-video-${liveFeed.id}');
                            if (video) {
                                video.src = '${liveUrl || ''}';
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
                                <span class="fw-bold fs-5 live-title-ellipsis" title="${liveFeed.title  || liveFeed.owner.display_id || ''}">${liveFeed.title || liveFeed.owner.display_id || ''}</span>
                            </div>
                            <div class="text-muted small mt-1">@${liveFeed.owner.display_id}</div>
                            <div class="mb-2">
                                ${videoPlayer}
                            </div>
                            <div class="mb-2">
                                ${aliveBadge}
                            </div>
                            <div class="mb-2">
                                Room ID: <span class="text-truncate">${liveFeed.id_str || ''}</span>
                            </div>
                            <div class="mb-2 mt-3">
                                ${addToMirrorBtn}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        });
    }

    // Handler for Start/Stop toggle button
    $(document).on("click", ".live-add-mirror", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const action = $(this).data("action");
        const token = localStorage.getItem("jwt_token");
        $(this).prop("disabled", true);
        $(this).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...');
        if (action === 'addMirror') {
            $.ajax({
                url: '/api/mirrors',
                method: 'POST',
                contentType: 'application/json',
                headers: { Authorization: 'Bearer ' + token },
                data: JSON.stringify({ tiktok: id }),
                success: function(resp) {
                    showSnackbar("Mirror added successfully.", false);
                    fetchLiveFeeds();
                },
                error: function(xhr) {
                    let msg = 'Failed to add mirror.';
                    if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                    showSnackbar(msg, true);
                    $(this).prop("disabled", false);
                    $(this).html('Add Mirror');
                },
                complete: function() {
                    $(this).prop("disabled", false);
                    $(this).html('Add Mirror');
                }
            });
        }
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
    $(document).on("click", ".live-rtmpurl-save", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const newUrl = $(`#live-rtmpurl-input-${id}`).val();
        $.ajax({
            url: `/api/live/${id}/rtmp-url`,
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
    $(document).on("click", ".live-streamkey-save", function(e) {
        e.preventDefault();
        const id = $(this).data("id");
        const newKey = $(`#live-streamkey-input-${id}`).val();
        $.ajax({
            url: `/api/live/${id}/stream-key`,
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
    $(document).on("click", ".live-password-toggle", function() {
        const input = $(this).siblings('input');
        const type = input.attr('type') === 'password' ? 'text' : 'password';
        input.attr('type', type);
        $(this).find('i').toggleClass('fa-eye fa-eye-slash');
    });

    // Handle Add Mirror button (modal is auto-handled by Bootstrap)
    $("#addLiveForm").on("submit", function(e) {
        e.preventDefault();
        const input = $("#liveInput").val().trim();
        if (!input) {
            $("#liveInput").addClass("is-invalid");
            return;
        }
        $("#liveInput").removeClass("is-invalid");
        const token = localStorage.getItem("jwt_token");
        $("#addLiveModal .btn-primary").prop("disabled", true);
        // show loading spinner
        $("#addLiveModal .btn-primary").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...');
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

    // Initial load
    fetchLiveFeeds();
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
