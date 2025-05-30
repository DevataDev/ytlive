$(function () {
    // Initialize variables
    let isLoadMore = false;
    let searchID = "";
    let searchFeeds = [];
    let currentPage = 1;
    let hasMore = true;
    let isLoading = false;
    let searchType = 'user'; // 'user', 'hashtag', or 'live'
    let currentSearchQuery = '';

    // Auth check and logout
    if (!localStorage.getItem("jwt_token")) {
        window.location.href = "/";
        return;
    }
    
    $("#logoutBtn").click(function () {
        localStorage.removeItem("jwt_token");
        $.post("/api/logout");
        window.location.href = "/";
    });

    // Initialize search filters
    $(".filter-btn").on("click", function() {
        $(".filter-btn").removeClass("active");
        $(this).addClass("active");
        searchType = $(this).data("type");
        currentPage = 1;
        hasMore = true;
        performSearch(currentSearchQuery, false);
    });

    // Search button click handler
    $("#searchButton").on("click", function() {
        const query = $("#searchInput").val().trim();
        if (query) {
            currentSearchQuery = query;
            currentPage = 1;
            hasMore = true;
            performSearch(query, false);
        }
    });

    // Handle Enter key in search input
    $("#searchInput").on("keypress", function(e) {
        if (e.which === 13) { // Enter key
            const query = $(this).val().trim();
            if (query) {
                currentSearchQuery = query;
                currentPage = 1;
                hasMore = true;
                performSearch(query, false);
            }
        }
    });

    // Load more button click handler
    $(document).on("click", "#loadMoreBtn", function() {
        console.log("Load more clicked");
        if (!isLoading && hasMore) {
            currentPage++;
            performSearch(currentSearchQuery, true);
        }
    });

    function performSearch(query, isLoadMore = false) {
        console.log("Performing search for query:", query);
        if (!query && !isLoadMore) {
            // If no query and not loading more, show suggested feeds
            fetchSuggestedFeeds();
            return;
        }

        const token = localStorage.getItem("jwt_token");
        const $loadingIndicator = $("#loadingIndicator");
        const $roomList = $("#room-list-cards");
        const $loadMoreBtn = $("#loadMoreBtn");

        if (!isLoadMore) {
            $loadingIndicator.show();
            $loadMoreBtn.hide();
            if (window._flvPlayers) {
                cleanupPlayers();
            }
        } else {
            $loadMoreBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...');
        }

        isLoading = true;

        let apiUrl = '/api/tiktok/search';
        const params = {
            query: query,
            type: searchType,
            page: currentPage,
            is_load_more: isLoadMore,
            search_id: searchID
        };

        $.ajax({
            url: apiUrl,
            method: 'GET',
            data: params,
            headers: { Authorization: 'Bearer ' + token },
            success: function(data) {
                if (data && data.rooms && data.rooms.length > 0) {
                    // Update search ID for pagination
                    if (data.pagination && data.pagination.search_id) {
                        searchID = data.pagination.search_id;
                    }
                    
                    // Update hasMore flag
                    hasMore = data.pagination ? data.pagination.has_more : false;
                    
                    // Update UI
                    if (isLoadMore) {
                        // Append new results
                        searchFeeds = [...searchFeeds, ...data.rooms];
                    } else {
                        // Replace results
                        searchFeeds = data.rooms;
                    }
                    
                    // Update count
                    $("#countRoom").text(searchFeeds.length);

                    console.dir(`hasMore: ${hasMore}`);
                    console.dir(`isLoadMore: ${isLoadMore}`);
                    console.dir(`searchFeeds: ${searchFeeds}`);
                    
                    
                    // Render the results
                    renderLiveFeedsTable({
                        rooms: searchFeeds,
                        pagination: data.pagination || { has_more: false }
                    });
                    
                    // Show/hide load more button
                    if (hasMore) {
                        $loadMoreBtn.show();
                    } else if (searchFeeds.length === 0) {
                        $roomList.html('<div class="col-12 text-center py-5"><div class="empty-state"><i class="bi bi-search fs-1 text-muted mb-3"></i><h5 class="mb-2">No results found</h5><p class="text-muted">Try different keywords or check back later.</p></div></div>');
                    }
                } else if (!isLoadMore) {
                    // No results for initial search
                    $roomList.html('<div class="col-12 text-center py-5"><div class="empty-state"><i class="bi bi-search fs-1 text-muted mb-3"></i><h5 class="mb-2">No results found</h5><p class="text-muted">Try different keywords or check back later.</p></div></div>');
                    $("#countRoom").text('0');
                } else {
                    //show you have reached the end of the search results
                    $loadMoreBtn.hide();
                    $loadMoreBtn.after(`
                        <div id="loadMoreBtnWrapper" class="text-center my-4">
                            <div class="text-muted">
                                <i class="bi bi-check-circle me-2"></i> You have reached the end of the search results
                            </div>
                        </div>
                    `);
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.message || "Failed to perform search. Please try again.";
                if (!isLoadMore) {
                    $roomList.html(`
                        <div class="col-12 text-center py-5">
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                ${errorMsg}
                            </div>
                            <button class="btn btn-primary mt-3" id="retrySearchBtn">
                                <i class="bi bi-arrow-repeat me-2"></i>Retry
                            </button>
                        </div>
                    `);
                }
                console.error('Search error:', errorMsg);
            },
            complete: function() {
                $loadingIndicator.hide();
                $loadMoreBtn.prop('disabled', false).html('<i class="bi bi-arrow-down-circle me-2"></i>Load More');
                isLoading = false;
            }
        });
    }

    function fetchSuggestedFeeds() {
        const token = localStorage.getItem("jwt_token");
        const $loadingIndicator = $("#loadingIndicator");
        const $roomList = $("#room-list-cards");
        
        $loadingIndicator.show();
        $roomList.empty();
        
        $.ajax({
            url: '/api/tiktok/suggested-feed',
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            success: function(data) {
                if (data && data.rooms && data.rooms.length > 0) {
                    searchFeeds = data.rooms;
                    $("#countRoom").text(searchFeeds.length);
                    renderLiveFeedsTable({
                        rooms: searchFeeds,
                        pagination: { has_more: false }
                    });
                } else {
                    $roomList.html('<div class="col-12 text-center py-5"><div class="empty-state"><i class="bi bi-broadcast fs-1 text-muted mb-3"></i><h5 class="mb-2">No live streams found</h5><p class="text-muted">There are no live streams available at the moment.</p></div></div>');
                }
            },
            error: function() {
                $roomList.html('<div class="col-12 text-center text-danger py-5">Failed to load suggested streams.</div>');
            },
            complete: function() {
                $loadingIndicator.hide();
            }
        });
    }

    function cleanupPlayers() {
        // Clean up FLV players
        if (window._flvPlayers) {
            Object.entries(window._flvPlayers).forEach(([id, player]) => {
                try {
                    if (player) {
                        player.pause();
                        player.unload();
                        player.detachMediaElement();
                        player.destroy();
                    }
                } catch (e) {
                    console.warn('Error cleaning up FLV player:', e);
                }
            });
            window._flvPlayers = {};
        }

        // Clean up video.js players
        if (window._videoJsPlayers) {
            window._videoJsPlayers.forEach(player => {
                try {
                    if (player && typeof player.dispose === 'function') {
                        player.dispose();
                    }
                } catch (e) {
                    console.warn('Error cleaning up video.js player:', e);
                }
            });
            window._videoJsPlayers = [];
        }
    }

    function renderLiveFeedsTable(liveFeeds) {
        const cardContainer = $("#room-list-cards");
        
        // Only clear existing cards if not loading more
        if (!isLoadMore) {
            cleanupPlayers();
            cardContainer.empty();
        }
        
        // Check if we have rooms to display
        const hasRooms = liveFeeds?.rooms?.length > 0;
        const hasMore = liveFeeds?.pagination?.has_more === true || liveFeeds?.rooms == null;
        
        // If no rooms and not loading more, show empty state
        if (!hasRooms && !isLoadMore) {
            cardContainer.html(`
                <div class="col-12 text-center py-5">
                    <div class="empty-state">
                        <i class="bi bi-broadcast fs-1 text-muted mb-3"></i>
                        <h5 class="mb-2">No live streams found</h5>
                        <p class="text-muted mb-4">There are no live streams available at the moment.</p>
                        <button class="btn btn-primary" id="refreshListBtn">
                            <i class="bi bi-arrow-repeat me-2"></i>Refresh
                        </button>
                    </div>
                </div>
            `);
            return;
        }

        console.dir(`hasMore: ${hasMore}`);
        console.dir(`hasRooms: ${hasRooms}`);
        
        // If we're loading more but got no new rooms, just return without doing anything
        if (isLoadMore && !hasRooms) {
            return;
        }

        liveFeeds.rooms.forEach((liveFeed) => {
            const viewCount = formatNumber(liveFeed.stats?.total_user || 0);
            const roomTitle = liveFeed.title || "Untitled Stream";
            const username = liveFeed.owner?.display_id || "unknown";
            const roomId = liveFeed.id_str || "";
            const liveUrl = liveFeed.live_url || "";
            const avatarText = username.charAt(0).toUpperCase();

            // Create video player HTML based on stream type
            let videoPlayerHtml = "";
            if (liveUrl) {
                if (liveUrl.includes(".flv?")) {
                    // For FLV streams, use flv.js
                    videoPlayerHtml = `
                        <div class="video-container">
                            <video id="live-video-${liveFeed.id}" 
                                   controls 
                                   playsinline
                                   style="width:100%; height:100%; background:#000;"></video>
                        </div>
                        <script>
                            (function() {
                                function initFLVPlayer() {
                                    try {
                                        const videoId = 'live-video-${liveFeed.id}';
                                        const video = document.getElementById(videoId);
                                        
                                        if (!video) {
                                            console.warn('Video element not found:', videoId);
                                            return;
                                        }
                                        
                                        // Clean up any existing player for this video
                                        if (window._flvPlayers && window._flvPlayers['${liveFeed.id}']) {
                                            try {
                                                const oldPlayer = window._flvPlayers['${liveFeed.id}'];
                                                oldPlayer.pause();
                                                oldPlayer.unload();
                                                oldPlayer.detachMediaElement();
                                                oldPlayer.destroy();
                                                delete window._flvPlayers['${liveFeed.id}'];
                                            } catch (e) {
                                                console.warn('Error cleaning up existing FLV player:', e);
                                            }
                                        }
                                        
                                        if (typeof flvjs === 'undefined' || !flvjs.isSupported()) {
                                            console.warn('flv.js is not supported or not loaded');
                                            video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvbj0ibm9uZSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAwMDAwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZmZmIj5Ccm93c2VyIG9yIHN0cmVhbSB0eXBlIG5vdCBzdXBwb3J0ZWQ8L3RleHQ+PC9zdmc+';
                                            return;
                                        }
                                        
                                        try {
                                            flvjs.LoggingControl.enableAll = false;
                                            const flvPlayer = flvjs.createPlayer({
                                                type: 'flv',
                                                url: '${liveUrl}',
                                                isLive: true,
                                                hasAudio: true,
                                                hasVideo: true,
                                                enableStashBuffer: false,
                                                stashInitialSize: 128
                                            });
                                            
                                            flvPlayer.attachMediaElement(video);
                                            flvPlayer.load();
                                            
                                            // Store reference for cleanup
                                            if (!window._flvPlayers) window._flvPlayers = {};
                                            window._flvPlayers['${liveFeed.id}'] = flvPlayer;
                                            
                                            // Handle player errors
                                            flvPlayer.on('error', function(error) {
                                                console.error('FLV Player Error:', error);
                                                video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvbj0ibm9uZSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAwMDAwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZmZmIj5FcnJvciBsb2FkaW5nIHN0cmVhbTwvdGV4dD48L3N2Zz4=';
                                                
                                                // Attempt to recover from errors
                                                try {
                                                    flvPlayer.unload();
                                                    flvPlayer.detachMediaElement();
                                                    flvPlayer.attachMediaElement(video);
                                                    flvPlayer.load();
                                                } catch (e) {
                                                    console.error('Error recovering player:', e);
                                                }
                                            });
                                            
                                        } catch (e) {
                                            console.error('Error creating FLV player:', e);
                                            video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvbj0ibm9uZSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAwMDAwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZmZmIj5VbmFibGUgdG8gaW5pdGlhbGl6ZSBwbGF5ZXI8L3RleHQ+PC9zdmc+';
                                        }
                                    } catch (e) {
                                        console.error('Error in FLV player initialization:', e);
                                    }
                                }
                                
                                // Wait for flvjs to be available
                                if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
                                    initFLVPlayer();
                                } else {
                                    // If flvjs isn't loaded yet, wait for it
                                    const checkFLV = setInterval(function() {
                                        if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
                                            clearInterval(checkFLV);
                                            initFLVPlayer();
                                        }
                                    }, 100);
                                    
                                    // Give up after 5 seconds
                                    setTimeout(function() {
                                        clearInterval(checkFLV);
                                        const video = document.getElementById('live-video-${liveFeed.id}');
                                        if (video) {
                                            video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvbj0ibm9uZSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzAwMDAwMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjZmZmIj5GYWlsZWQgdG8gbG9hZCBmbHYuanM8L3RleHQ+PC9zdmc+';
                                        }
                                    }, 5000);
                                }
                            })();
                        </script>
                    `;
                } else if (liveUrl && (liveUrl.includes('.m3u8') || liveUrl.includes('m3u'))) {
                    // For HLS streams, use video.js with HLS support
                    videoPlayerHtml = `
                        <div class="video-container">
                            <video id="live-video-${liveFeed.id}" 
                                   class="video-js vjs-default-skin vjs-big-play-centered"
                                   controls 
                                   preload="auto" 
                                   playsinline>
                            </video>
                        </div>
                        <script>
                            (function() {
                                try {
                                    const video = document.getElementById('live-video-${liveFeed.id}');
                                    if (video) {
                                        // Initialize video.js with HLS support
                                        const player = videojs(video, {
                                            controls: true,
                                            autoplay: false,
                                            preload: 'auto',
                                            sources: [{
                                                src: '${liveUrl}',
                                                type: 'application/x-mpegURL'
                                            }],
                                            html5: {
                                                hls: {
                                                    enableLowInitialPlaylist: true,
                                                    smoothQualityChange: true,
                                                    overrideNative: true
                                                }
                                            }
                                        });
                                        
                                        // Store reference for cleanup
                                        if (!window._videoJsPlayers) window._videoJsPlayers = [];
                                        window._videoJsPlayers.push({
                                            id: '${liveFeed.id}',
                                            player: player
                                        });

                                        // Handle player errors
                                        player.on('error', function() {
                                            const error = player.error();
                                            console.error('Video.js Error:', error);
                                            showSnackbar('Error playing video stream', true);
                                        });
                                    }
                                } catch (e) {
                                    console.error('Error initializing video player:', e);
                                    showSnackbar('Failed to initialize video player', true);
                                }
                            })();
                        </script>
                    `;
                } else if (liveUrl && liveUrl.includes('.mp4')) {
                    // For direct MP4 streams
                    videoPlayerHtml = `
                        <div class="video-container">
                            <video id="live-video-${liveFeed.id}" 
                                   class="video-js vjs-default-skin vjs-big-play-centered"
                                   controls 
                                   preload="auto" 
                                   playsinline>
                                <source src="${liveUrl}" type="video/mp4">
                            </video>
                        </div>
                        <script>
                            (function() {
                                try {
                                    const video = document.getElementById('live-video-${liveFeed.id}');
                                    if (video) {
                                        const player = videojs(video, {
                                            controls: true,
                                            autoplay: false,
                                            preload: 'auto'
                                        });
                                        
                                        if (!window._videoJsPlayers) window._videoJsPlayers = [];
                                        window._videoJsPlayers.push({
                                            id: '${liveFeed.id}',
                                            player: player
                                        });

                                        player.on('error', function() {
                                            console.error('Video.js Error:', player.error());
                                            showSnackbar('Error playing video', true);
                                        });
                                    }
                                } catch (e) {
                                    console.error('Error initializing MP4 player:', e);
                                    showSnackbar('Failed to initialize video player', true);
                                }
                            })();
                        </script>
                    `;
                } else {
                    videoPlayerHtml = `
                        <div class="video-placeholder d-flex align-items-center justify-content-center" 
                            style="background: #f8f9fa; border-radius: var(--border-radius); height: 200px;">
                            <div class="text-center">
                                <i class="bi bi-camera-video-off fs-1 text-muted"></i>
                                <p class="mt-2 mb-0 text-muted">No stream available</p>
                            </div>
                        </div>
                    `;
                }
            }

                // Create the card HTML
                const cardHtml = `
                    <div class="col-12 col-sm-6 col-lg-4 col-xxl-3 mb-4">
                        <div class="card h-auto shadow-sm">
                            <div class="card-img-top position-relative" style="aspect-ratio: 16/9; overflow: hidden; background: #000;">
                                ${videoPlayerHtml}
                            </div>
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title text-truncate mb-1" title="${roomTitle}">${roomTitle}</h5>
                            <div class="d-flex align-items-center mb-2">
                                <div class="avatar-sm me-2">
                                    <span class="avatar-title rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 24px; height: 24px; font-size: 12px;">
                                        ${avatarText}
                                    </span>
                                </div>
                                <small class="text-muted">@${username}</small>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-auto">
                                <span class="badge bg-danger">
                                    <i class="bi bi-circle-fill me-1"></i>
                                    ${viewCount} watching
                                </span>
                                <button class="btn btn-outline-primary btn-sm search-add-mirror" data-id="${roomId}" data-title="${roomTitle}" data-action="addMirror">
                                    <i class="bi bi-plus-circle me-1"></i> Add Mirror
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            cardContainer.append(cardHtml);
        });
        
        // Show/hide load more button based on pagination
        const $loadMoreBtn = $("#loadMoreBtn");
        if (hasMore) {
            $loadMoreBtn.removeClass("d-none");
        } else {
            $loadMoreBtn.addClass("d-none");
        }
        
        // Re-initialize tooltips for the new elements
        $('[data-bs-toggle="tooltip"]').tooltip();
    }

    function formatNumber(num) {
        if (!num) return '0';
        
        // If thousands, add K
        if (num >= 1000 && num < 1000000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        // If millions, add M
        else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        // If less than 1000, return as is
        return num.toString();
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
                <button class="btn btn-success btn-sm search-add-mirror w-100" data-id="${searchFeed.id_str}" data-title="${searchFeed.title}" data-action="addMirror">Add to Mirror</button>
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
        } else if (!searchHasMore) {
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
                    fetchSuggestedFeeds();
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

    fetchSuggestedFeeds();
});
