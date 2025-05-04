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
            let viewCount = formatNumber(liveFeed.stats.total_user);
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
                            <div class="text-muted small mt-1">@${liveFeed.owner.display_id} | View : ${viewCount}</div>
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

    function formatNumber(num) {
        //if thousands add K, if millions add M
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num;
    }

    function renderSearchFeedsTable(searchFeeds, append = false) {
        const cardContainer = $("#room-list-cards");
        cardContainer.html('');
        searchFeeds.forEach(function(searchFeed) {
            let videoPlayer;
            let liveUrl = searchFeed.live_url;
            let viewCount = formatNumber(searchFeed.stats.total_user);
            if (liveUrl && liveUrl.includes('.flv?')) {
                videoPlayer = `
                    <video id="live-video-${searchFeed.id}" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                    <script>
                        window._liveFlvPlayers = window._liveFlvPlayers || {};
                        setTimeout(function() {
                            try {
                                if (window._liveFlvPlayers['${searchFeed.id}']) {
                                    window._liveFlvPlayers['${searchFeed.id}'].destroy();
                                    delete window._liveFlvPlayers['${searchFeed.id}'];
                                }
                                var video = document.getElementById('live-video-${searchFeed.id}');
                                if (video && window.flvjs && flvjs.isSupported()) {
                                    var flvPlayer = flvjs.createPlayer({ type: 'flv', url: '${liveUrl}', "isLive": true });
                                    flvPlayer.attachMediaElement(video);
                                    flvPlayer.load();
                                    window._mirrorFlvPlayers['${searchFeed.id}'] = flvPlayer;
                                }
                            } catch(e){}
                        }, 100);
                    </script>
                `;
            } else if (liveUrl && liveUrl.includes('.m3u8')) {
                videoPlayer = `
                <video id="live-video-${searchFeed.id}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                <script>
                    window._liveHlsPlayers = window._liveHlsPlayers || {};
                    setTimeout(function() {
                        try {
                            if (window._liveHlsPlayers['${searchFeed.id}']) {
                                window._liveHlsPlayers['${searchFeed.id}'].destroy && window._liveHlsPlayers['${searchFeed.id}'].destroy();
                                delete window._liveHlsPlayers['${searchFeed.id}'];
                            }
                            var video = document.getElementById('live-video-${searchFeed.id}');
                            if (video && window.Hls && Hls.isSupported()) {
                                var hls = new Hls();
                                hls.loadSource('${liveUrl}');
                                hls.attachMedia(video);
                                window._liveHlsPlayers['${searchFeed.id}'] = hls;
                            } else if (video) {
                                video.src = '${liveUrl}';
                                videojs(video);
                            }
                        } catch(e){}
                    }, 100);
                </script>
            `;
            } else {
                videoPlayer = `<video id="live-video-${searchFeed.id}" class="video-js vjs-default-skin vjs-fluid" controls preload="auto" style="max-height:180px;background:#000;width:100%;"></video>
                <script>
                    setTimeout(function() {
                        try {
                            var video = document.getElementById('live-video-${searchFeed.id}');
                            if (video) {
                                video.src = '${liveUrl || ''}';
                                videojs(video);
                            }
                        } catch(e){}
                    }, 100);
                </script>`;
            }
            const addToMirrorBtn = `
                <button class="btn btn-success btn-sm search-add-mirror w-100" data-id="${searchFeed.id_str}" data-action="addMirror">Add to Mirror</button>
            `;
            const aliveBadge = `<span class="badge bg-success">Alive</span>`;
            cardContainer.append(`
                <div class="col-md-4">
                    <div class="card stream-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-2">
                                <span class="fw-bold fs-5 live-title-ellipsis" title="${searchFeed.title  || searchFeed.owner.display_id || ''}">${searchFeed.title || searchFeed.owner.display_id || ''}</span>
                            </div>
                            <div class="text-muted small mt-1">@${searchFeed.owner.display_id} | View: ${viewCount}</div>
                            <div class="mb-2">
                                ${videoPlayer}
                            </div>
                            <div class="mb-2">
                                ${aliveBadge}
                            </div>
                            <div class="mb-2">
                                Room ID: <span class="text-truncate">${searchFeed.id_str || ''}</span>
                            </div>
                            <div class="mb-2 mt-3">
                                ${addToMirrorBtn}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        });

        // Remove existing load more button if any
        $("#loadMoreBtnWrapper").remove();

        // Add Load More button if needed
        if (searchHasMore && searchFeeds.length > 0) {
            cardContainer.after(`
                <div id="loadMoreBtnWrapper" class="text-center my-3">
                    <button id="loadMoreBtn" class="btn btn-primary">${searchLoading ? 'Loading...' : 'Load More'}</button>
                </div>
            `);
        } else if (searchFeeds.length > 0) {
            cardContainer.after(`
                <div id="loadMoreBtnWrapper" class="text-center my-3">
                    <button id="loadMoreBtn" class="btn btn-secondary" disabled>No more results</button>
                </div>
            `);
        }
    }

    // --- Infinity Scroll State ---
    let searchPage = 1;
    let searchHasMore = true;
    let searchLoading = false;
    let searchKeyword = '';
    let searchFeedsAll = [];
    let searchId = '';

    function fetchSearchFeeds(page = 1, append = false) {
        const token = localStorage.getItem("jwt_token");
        const searchInput = $("#searchInput").val();

        if (!searchInput) {
            showSnackbar("Please enter a search keyword.", true);
            return;
        }

        if (searchLoading) {
            console.log("fetchSearchFeeds called but already loading");
            return;
        }
        searchLoading = true;

        if (!append) {
            searchPage = 1;
            searchHasMore = true;
            searchFeedsAll = [];
            searchKeyword = searchInput;
            searchId = '';
        }

        let paginationAppendUrl = '';
        if (append || searchPage > 1) {
            paginationAppendUrl = `?page=${searchPage}`;
        }

        console.log("Calling /api/tiktok/search", {
            url: '/api/tiktok/search' + paginationAppendUrl,
            page: searchPage,
            append,
            searchId,
            searchKeyword
        });

        $.ajax({
            url: '/api/tiktok/search' + paginationAppendUrl,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ keyword: encodeURIComponent(searchKeyword), search_id: searchId }),
            headers: { Authorization: 'Bearer ' + token },
            success: function(data) {
                console.log("API Success", data);
                if (append) {
                    searchFeedsAll = searchFeedsAll.concat(data.rooms || []);
                } else {
                    searchFeedsAll = data.rooms || [];
                }
                if (searchId != data.pagination.search_id) {
                    searchId = data.pagination.search_id;
                }
                renderSearchFeedsTable(searchFeedsAll, append);
                $("#countRoom").text(searchFeedsAll.length);
                searchHasMore = data.pagination.has_more;
                searchPage += 1;
                searchLoading = false;
                console.log("After success:", {searchHasMore, searchPage, searchFeedsAllLength: searchFeedsAll.length});
            },
            error: function(xhr) {
                console.log("API Error", xhr);
                searchLoading = false;
                $("#room-list-cards").html('<div class="col-12 text-center text-danger">Failed to load rooms.</div>');
            },
            complete: function() {
                searchLoading = false;
                console.log("AJAX complete, loading reset");
                // Remove existing load more button if any
                $("#loadMoreBtnWrapper").remove();
                let cardContainer = $("#room-list-cards");

                // Add Load More button if needed
                if (searchHasMore) {
                    cardContainer.after(`
                        <div id="loadMoreBtnWrapper" class="text-center my-3">
                            <button id="loadMoreBtn" class="btn btn-primary">${searchLoading ? 'Loading...' : 'Load More'}</button>
                        </div>
                    `);
                } else if (!searchHasMore) {
                    cardContainer.after(`
                        <div id="loadMoreBtnWrapper" class="text-center my-3">
                            <button id="loadMoreBtn" class="btn btn-secondary" disabled>No more results</button>
                        </div>
                    `);
                }
            }
        });
    }

    // Remove infinite scroll handler for clarity
    $(window).off('scroll');

    // Handler for Load More button
    $(document).off('click', '#loadMoreBtn');
    $(document).on('click', '#loadMoreBtn', function() {
        if (!searchHasMore || searchLoading) return;
        fetchSearchFeeds(searchPage, true);
    });

    // Handler for Search button
    $(document).on("click", "#searchBtn", function(e) {
        e.preventDefault();
        fetchSearchFeeds(1, false);
    });

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

    // Handler for Start/Stop toggle button
    $(document).on("click", ".search-add-mirror", function(e) {
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
                    $(".search-add-mirror[data-id='" + id + "']").html("Mirror added");
                    $(".search-add-mirror[data-id='" + id + "']").prop("disabled", true);
                },
                error: function(xhr) {
                    let msg = 'Failed to add mirror.';
                    if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                    showSnackbar(msg, true);
                    $(".search-add-mirror[data-id='" + id + "']").html("Add Mirror");
                    $(".search-add-mirror[data-id='" + id + "']").prop("disabled", false);
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

    fetchLiveFeeds();
});
