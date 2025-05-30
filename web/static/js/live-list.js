$(function () {
  // Initialize variables
  let isLoadMore = false;
  let searchID = "";
  let feedRooms = [];

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

  // Variables moved to the top for better scoping

  function fetchLiveFeeds(showLoading = true) {
    const token = localStorage.getItem("jwt_token");
    const $loadingIndicator = $("#loadingIndicator");
    const $roomList = $("#room-list-cards");

    if (showLoading) {
      $loadingIndicator.show();
      if (!isLoadMore) {
        $roomList.find(".stream-card").remove();
      }
    }

    $.ajax({
      url:
        "/api/tiktok/live-feed?is_load_more=" +
        isLoadMore +
        "&search_id=" +
        searchID,
      method: "GET",
      headers: { Authorization: "Bearer " + token },
      success: function (data) {
        // Ensure we have valid data before processing
        if (data && data.rooms && data.rooms.length > 0) {
          // Clean up players before updating the list
          if (window._flvPlayers) {
            Object.keys(window._flvPlayers).forEach(id => {
              if (!data.rooms.some(room => room.id_str === id)) {
                // Clean up players for rooms that are no longer in the response
                try {
                  const player = window._flvPlayers[id];
                  if (player) {
                    player.pause();
                    player.unload();
                    player.detachMediaElement();
                    player.destroy();
                  }
                  delete window._flvPlayers[id];
                } catch (e) {
                  console.warn('Error cleaning up old FLV player:', e);
                }
              }
            });
          }
          if (isLoadMore) {
            // Only add new rooms that aren't already in the feedRooms array
            const newRooms = data.rooms.filter(newRoom => 
              !feedRooms.some(existingRoom => existingRoom.id_str === newRoom.id_str)
            );
            feedRooms = newRooms;
          } else {
            feedRooms = data.rooms;
          }
        }
        
        // Update the UI with the current count of unique rooms
        $("#countRoom").text(feedRooms.length);
        
        // Update search ID and load more state
        if (data.pagination) {
          if (data.pagination.search_id && data.pagination.search_id !== searchID) {
            searchID = data.pagination.search_id;
          }
          // Only update isLoadMore if we have pagination info
          isLoadMore = data.pagination.has_more;
        }
        
        // Only show no items message if we don't have any rooms and we're not in load more mode
        if (feedRooms.length === 0 && !isLoadMore) {
          renderLiveFeedsTable({ rooms: [] });
        } else {
          // Render the combined feedRooms array
          renderLiveFeedsTable({ 
            rooms: feedRooms,
            pagination: data.pagination // Pass through pagination info
          });
        }
      },
      error: function (xhr) {
        const errorMsg =
          xhr.responseJSON?.message ||
          "Failed to load live streams. Please try again.";
        $roomList.html(`
                    <div class="col-12 text-center py-5">
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>
                            ${errorMsg}
                        </div>
                        <button class="btn btn-primary mt-3" id="retryBtn">
                            <i class="bi bi-arrow-repeat me-2"></i>Retry
                        </button>
                    </div>
                `);
      },
      complete: function () {
        $loadingIndicator.hide();
      },
    });
  }

  function renderLiveFeedsTable(liveFeeds) {
    const cardContainer = $("#room-list-cards");

    // Clean up existing players before removing cards
    function cleanupPlayers() {
      // Clean up FLV players
      if (window._flvPlayers) {
        Object.entries(window._flvPlayers).forEach(([id, player]) => {
          try {
            if (player) {
              // Pause and clean up the player
              player.pause();
              
              // Get the video element before detaching
              const videoEl = player.mediaElement;
              
              // Properly unload and destroy the player
              try {
                player.unload();
              } catch (e) {
                console.warn('Error unloading FLV player:', e);
              }
              
              try {
                player.detachMediaElement();
              } catch (e) {
                console.warn('Error detaching FLV player media element:', e);
              }
              
              try {
                player.destroy();
              } catch (e) {
                console.warn('Error destroying FLV player:', e);
              }
              
              // Clean up the video element
              if (videoEl) {
                try {
                  videoEl.pause();
                  videoEl.removeAttribute('src');
                  videoEl.load();
                  if (videoEl.parentNode) {
                    videoEl.parentNode.removeChild(videoEl);
                  }
                } catch (e) {
                  console.warn('Error cleaning up video element:', e);
                }
              }
              
              delete window._flvPlayers[id];
            }
          } catch (e) {
            console.warn('Error during FLV player cleanup:', e);
          }
        });
      }
      
      // Clean up video.js players
      if (window._videoJsPlayers) {
        window._videoJsPlayers.forEach(player => {
          try {
            if (player) {
              // Get the video element before disposing
              const videoEl = player.el();
              
              // Dispose the player
              if (typeof player.dispose === 'function') {
                player.dispose();
              }
              
              // Clean up the video element
              if (videoEl) {
                try {
                  videoEl.pause && videoEl.pause();
                  videoEl.removeAttribute('src');
                  videoEl.load();
                  if (videoEl.parentNode) {
                    videoEl.parentNode.removeChild(videoEl);
                  }
                } catch (e) {
                  console.warn('Error cleaning up video.js video element:', e);
                }
              }
            }
          } catch (e) {
            console.warn('Error during video.js player cleanup:', e);
          }
        });
        window._videoJsPlayers = [];
      }
    }

    // Only clear existing cards if not loading more
    cleanupPlayers();
    // cardContainer.find(".stream-card").remove();
    cardContainer.empty();
    
    // Check if we have rooms to display
    const hasRooms = liveFeeds?.rooms?.length > 0;
    const hasMore = liveFeeds?.pagination?.has_more === true;
    
    // If no rooms and not loading more, show empty state
    if (!hasRooms && !isLoadMore) {
      cardContainer.append(`
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
                                            video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDAwMDAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+QnJvd3NlciBvciBzdHJlYW0gdHlwZSBub3Qgc3VwcG9ydGVkPC90ZXh0Pjwvc3ZnPg==';
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
                                                video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDAwMDAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+RXJyb3IgbG9hZGluZyBzdHJlYW08L3RleHQ+PC9zdmc+';
                                                
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
                                            video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDAwMDAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+VW5hYmxlIHRvIGluaXRpYWxpemUgcGxheWVyPC90ZXh0Pjwvc3ZnPg==';
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
                                            video.poster = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDAwMDAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZiI+RmFpbGVkIHRvIGxvYWQgZmx2LmpzPC90ZXh0Pjwvc3ZnPg=';
                                        }
                                    }, 5000);
                                }
                            })();
                        </script>
                    `;
        } else {
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
                                        window._videoJsPlayers.push(player);
                                    }
                                } catch (e) {
                                    console.error('Error initializing video player:', e);
                                }
                            })();
                        </script>
                    `;
        }
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

      const cardHtml = `
                <div class="col-md-4 mb-4">
                    <div class="card stream-card h-100">
                        <div class="card-body p-0">
                            <!-- Header with avatar and title -->
                            <div class="p-3 border-bottom">
                                <div class="room-header">
                                    <div class="room-avatar">
                                        ${
                                          liveFeed.owner?.avatar_thumb
                                            ?.url_list?.[0]
                                            ? `<img src="${liveFeed.owner.avatar_thumb.url_list[0]}" alt="${username}" class="img-fluid rounded-circle" style="width: 40px; height: 40px; object-fit: cover;">`
                                            : avatarText
                                        }
                                    </div>
                                    <div class="room-info">
                                        <h3 class="room-title" title="${roomTitle}">${roomTitle}</h3>
                                        <p class="room-username mb-0">@${username}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Video Player -->
                            <div class="video-wrapper">
                                ${videoPlayerHtml}
                            </div>
                            
                            <!-- Stats and Actions -->
                            <div class="p-3">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <div class="viewers-count">
                                        <i class="bi bi-people-fill"></i>
                                        <span>${viewCount} watching</span>
                                    </div>
                                    <span class="badge bg-danger">
                                        <i class="bi bi-broadcast-pin me-1"></i> LIVE
                                    </span>
                                </div>
                                
                                <div class="action-buttons">
                                    <button class="btn btn-success w-100 live-add-mirror" 
                                        data-id="${liveFeed.id_str}" 
                                        data-action="addMirror">
                                        <i class="bi bi-plus-circle me-2"></i>Add to Mirror
                                    </button>
                                </div>
                                
                                <div class="mt-2 text-center">
                                    <small class="text-muted">Room ID: ${roomId}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

      cardContainer.append(cardHtml);
    });

    // Remove existing load more button if any
    $("#loadMoreBtnWrapper").remove();

    // Add Load More button if needed
    if (liveFeeds.pagination?.has_more && liveFeeds.rooms.length > 0) {
      cardContainer.after(`
                <div id="loadMoreBtnWrapper" class="text-center my-4">
                    <button id="loadMoreBtn" class="btn btn-primary px-4">
                        <i class="bi bi-arrow-down-circle me-2"></i>Load More
                    </button>
                </div>
            `);
    } else if (liveFeeds.rooms.length > 0) {
      cardContainer.after(`
                <div id="loadMoreBtnWrapper" class="text-center my-4">
                    <div class="text-muted">
                        <i class="bi bi-check-circle me-2"></i> No more streams to load
                    </div>
                </div>
            `);
    }
  }

  // handler for load more button
  $(document).on("click", "#loadMoreBtn", function (e) {
    e.preventDefault();
    isLoadMore = true;
    fetchLiveFeeds();
  });

  function formatNumber(num) {
    //if thousands add K, if millions add M
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num;
  }

  // Handler for Start/Stop toggle button
  $(document).on("click", ".live-add-mirror", function (e) {
    e.preventDefault();
    const id = $(this).data("id");
    const action = $(this).data("action");
    const token = localStorage.getItem("jwt_token");
    $(this).prop("disabled", true);
    $(this).html(
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...'
    );
    if (action === "addMirror") {
      $.ajax({
        url: "/api/mirrors",
        method: "POST",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        data: JSON.stringify({ tiktok: id }),
        success: function (resp) {
          showSnackbar("Mirror added successfully.", false);
          fetchLiveFeeds();
        },
        error: function (xhr) {
          let msg = "Failed to add mirror.";
          if (xhr.responseJSON && xhr.responseJSON.error)
            msg = xhr.responseJSON.error;
          showSnackbar(msg, true);
          $(this).prop("disabled", false);
          $(this).html("Add Mirror");
        },
        complete: function () {
          $(this).prop("disabled", false);
          $(this).html("Add Mirror");
        },
      });
    }
  });

  // Snackbar notification helper
  function showSnackbar(message, isError) {
    const toastEl = document.getElementById("streamToast");
    const toastBody = document.getElementById("streamToastBody");
    if (!toastEl || !toastBody) return;
    toastBody.textContent = message;
    toastEl.classList.remove("text-bg-danger", "text-bg-success");
    if (!isError) {
      toastEl.classList.add("text-bg-success");
    } else {
      toastEl.classList.add("text-bg-danger");
    }
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
  }

  // Handler for RTMP URL save
  $(document).on("click", ".live-rtmpurl-save", function (e) {
    e.preventDefault();
    const id = $(this).data("id");
    const newUrl = $(`#live-rtmpurl-input-${id}`).val();
    $.ajax({
      url: `/api/live/${id}/rtmp-url`,
      type: "PUT",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
      data: JSON.stringify({ rtmp_url: newUrl }),
      success: function () {
        showSnackbar("RTMP URL saved successfully.", false);
        fetchMirrors();
      },
      error: function (xhr) {
        showSnackbar(
          "Failed to save RTMP URL: " + (xhr.responseText || xhr.statusText),
          true
        );
      },
    });
  });

  // Handler for Stream Key save
  $(document).on("click", ".live-streamkey-save", function (e) {
    e.preventDefault();
    const id = $(this).data("id");
    const newKey = $(`#live-streamkey-input-${id}`).val();
    $.ajax({
      url: `/api/live/${id}/stream-key`,
      type: "PUT",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + localStorage.getItem("jwt_token") },
      data: JSON.stringify({ stream_key: newKey }),
      success: function () {
        showSnackbar("Stream Key saved successfully.", false);
        fetchMirrors();
      },
      error: function (xhr) {
        showSnackbar(
          "Failed to save Stream Key: " + (xhr.responseText || xhr.statusText),
          true
        );
      },
    });
  });

  // Password show/hide toggle
  $(document).on("click", ".live-password-toggle", function () {
    const input = $(this).siblings("input");
    const type = input.attr("type") === "password" ? "text" : "password";
    input.attr("type", type);
    $(this).find("i").toggleClass("fa-eye fa-eye-slash");
  });

  // Handle Add Mirror button (modal is auto-handled by Bootstrap)
  $("#addLiveForm").on("submit", function (e) {
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
    $("#addLiveModal .btn-primary").html(
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...'
    );
    $.ajax({
      url: "/api/mirrors",
      method: "POST",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      data: JSON.stringify({ tiktok: input }),
      success: function (resp) {
        $("#addMirrorModal").modal("hide");
        $("#mirrorInput").val("");
        $("#addMirrorModal .btn-primary").prop("disabled", false);
        $("#addMirrorModal .btn-primary").html("Add Mirror");
        showSnackbar("Mirror added successfully.", false);
        fetchMirrors();
      },
      error: function (xhr) {
        let msg = "Failed to add mirror.";
        if (xhr.responseJSON && xhr.responseJSON.error)
          msg = xhr.responseJSON.error;
        showSnackbar(msg, true);
        $("#addMirrorModal .btn-primary").prop("disabled", false);
        $("#addMirrorModal .btn-primary").html("Add Mirror");
      },
      complete: function () {
        $("#addMirrorForm button[type='submit']").prop("disabled", false);
      },
    });
  });

  // Initial load
  fetchLiveFeeds();

  // Refresh button handler
  $(document).on(
    "click",
    "#refreshBtn, #refreshListBtn, #retryBtn",
    function () {
      isLoadMore = false;
      searchID = "";
      fetchLiveFeeds(true);
    }
  );

  // Handle retry button in error state
  $(document).on("click", "#retryBtn", function () {
    fetchLiveFeeds(true);
  });
});

// Clean up video players when navigating away
$(window).on("beforeunload", function () {
  // Clean up FLV players
  if (window._flvPlayers) {
    Object.entries(window._flvPlayers).forEach(([id, player]) => {
      try {
        if (player) {
          player.pause();
          player.unload();
          player.detachMediaElement();
          player.destroy();
          delete window._flvPlayers[id];
        }
      } catch (e) {
        console.error("Error cleaning up FLV player:", e);
      }
    });
  }

  // Clean up video.js players
  if (window._videoJsPlayers) {
    window._videoJsPlayers.forEach((player, index) => {
      try {
        if (player && typeof player.dispose === "function") {
          player.dispose();
        }
      } catch (e) {
        console.error("Error cleaning up video.js player:", e);
      }
    });
    window._videoJsPlayers = [];
  }
});

// Also clean up when loading new content
$(document).on(
  "click",
  "#loadMoreBtn, #refreshBtn, #refreshListBtn, #retryBtn",
  function () {
    const isRefresh = $(this).is("#refreshBtn, #refreshListBtn, #retryBtn");
    const isLoadMore = $(this).is("#loadMoreBtn");

    // Clean up existing players when refreshing, but not when loading more
    if ((isRefresh || !isLoadMore) && window._flvPlayers) {
      Object.entries(window._flvPlayers).forEach(([id, player]) => {
        try {
          if (player) {
            player.pause();
            player.unload();
            player.detachMediaElement();
            player.destroy();
            delete window._flvPlayers[id];
          }
        } catch (e) {
          console.error("Error cleaning up FLV player:", e);
        }
      });
    }
  }
);
