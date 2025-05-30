// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let totalChannels = 0;
let channels = [];

// Generate avatar with initials
function getInitialsAvatar(name, size = 40) {
    // Get first letter of each word
    const initials = (name || 'YT')
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    // Generate a consistent color based on the name
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
        '#FFEEAD', '#D4A5A5', '#9B97B2', '#E8A87C',
        '#C38D9E', '#85DCB', '#E8A87C', '#41B3A3'
    ];
    
    // Simple hash function to get consistent color for same name
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    
    // Create SVG with the initials
    const svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="${colors[colorIndex]}" rx="8"/>
            <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" 
                  fill="white" text-anchor="middle" dy=".3em" font-weight="bold">
                ${initials}
            </text>
        </svg>
    `;
    
    // Convert SVG to data URL
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// DOM Elements
const tbody = document.querySelector('#channels-table tbody');
const loadingRow = document.getElementById('loading-row');
const emptyState = document.getElementById('empty-state');

// Initialize the page
function onload() {
    initPagination();
    setupEventListeners();
    fetchChannels();
}

// Initialize pagination event listeners
function initPagination() {
    // First page button
    document.getElementById('firstPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage = 1;
            renderChannels();
        }
    });

    // Previous page button
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderChannels();
        }
    });

    // Next page button
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const maxPage = Math.ceil(totalChannels / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            renderChannels();
        }
    });

    // Last page button
    document.getElementById('lastPage')?.addEventListener('click', () => {
        const maxPage = Math.ceil(totalChannels / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage = maxPage;
            renderChannels();
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setup event listeners')
    // Add channel form submission
    const addChannelBtn = document.getElementById('addChannelBtn');
    if (addChannelBtn) {
        console.log('Add channel button found')
        addChannelBtn.addEventListener('click', handleAddChannel);
    }

    // Delete channel button in the confirmation modal
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteChannel);
    }
}

// Handle add channel
async function handleAddChannel(e) {
    e.preventDefault();
    
    try {
        const jwtToken = localStorage.getItem('jwt_token');
        const response = await fetch('/api/youtube/authorize', {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ' + jwtToken 
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get authorization URL');
        }
        
        const data = await response.json();
        window.open(data.auth_url, '_blank');
        channelIdInput.value = '';
        showToast('Please authorize the application in the new tab', 'info');
    } catch (error) {
        console.error('Error adding channel:', error);
        showToast(error.message || 'Failed to add channel', 'danger');
    }
}

// Fetch channels from the API
async function fetchChannels() {
    showLoading(true);
    
    try {
        const jwtToken = localStorage.getItem('jwt_token');
        const response = await fetch('/api/youtube/list-channels', {
            headers: { 'Authorization': 'Bearer ' + jwtToken }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch channels');
        }
        
        const data = await response.json();
        channels = data.channels || [];
        totalChannels = channels.length;
        
        renderChannels();
    } catch (error) {
        console.error('Error fetching channels:', error);
        showToast('Failed to load channels. Please try again.', 'danger');
    } finally {
        showLoading(false);
    }
}

// Render channels in the table
function renderChannels() {
    if (!tbody) return;
    
    // Clear existing rows except loading/empty states
    tbody.innerHTML = '';
    
    if (channels.length === 0) {
        emptyState.style.display = '';
        updatePaginationUI();
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, channels.length);
    const paginatedChannels = channels.slice(startIndex, endIndex);
    
    // Create rows for each channel
    paginatedChannels.forEach(channel => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.innerHTML = `
            <td class="ps-4">
                <div class="channel-info">
                    <img src="${channel.ThumbnailURL || getInitialsAvatar(channel.ChannelName)}" 
                         alt="${channel.ChannelName || 'Channel'}" 
                         class="channel-avatar" 
                         onerror="this.src='${getInitialsAvatar(channel.ChannelName)}'"
                         loading="lazy"
                    >
                    <div>
                        <div class="channel-name">${channel.ChannelName || 'Unnamed Channel'}</div>
                        <div class="channel-id" title="Channel ID: ${channel.ID}">${channel.ID}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge bg-success status-badge">
                    <i class="bi bi-check-circle-fill me-1"></i> Connected
                </span>
            </td>
            <td class="text-end pe-4 action-buttons">
                <button class="btn btn-outline-danger btn-sm delete-channel-btn" 
                        data-bs-toggle="modal" 
                        data-bs-target="#deleteChannelModal"
                        data-channel-id="${channel.ID}"
                        data-channel-name="${channel.ChannelName || 'this channel'}">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Update pagination UI
    updatePaginationUI();
    
    // Attach event listeners to delete buttons
    document.querySelectorAll('.delete-channel-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteClick);
    });
}

// Handle delete button click
function handleDeleteClick(e) {
    const button = e.currentTarget;
    const channelId = button.getAttribute('data-channel-id');
    const channelName = button.getAttribute('data-channel-name');
    
    document.getElementById('channelIdToDelete').textContent = channelId;
    document.getElementById('confirmDeleteBtn').setAttribute('data-channel-id', channelId);
    
    const modalTitle = document.querySelector('#deleteChannelModal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = `Delete ${channelName}?`;
    }
}

// Confirm and delete channel
async function confirmDeleteChannel() {
    const button = document.getElementById('confirmDeleteBtn');
    const channelId = button.getAttribute('data-channel-id');
    
    if (!channelId) return;
    
    const spinner = button.querySelector('.spinner-border');
    const buttonText = button.querySelector('.btn-text');
    
    try {
        // Show loading state
        button.disabled = true;
        spinner.classList.remove('d-none');
        buttonText.textContent = 'Deleting...';
        
        const jwtToken = localStorage.getItem('jwt_token');
        const response = await fetch(`/api/youtube/channels/${channelId}`, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ' + jwtToken 
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete channel');
        }
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteChannelModal'));
        if (modal) modal.hide();
        
        // Refresh the channels list
        showToast('Channel deleted successfully', 'success');
        await fetchChannels();
    } catch (error) {
        console.error('Error deleting channel:', error);
        showToast(error.message || 'Failed to delete channel', 'danger');
    } finally {
        // Reset button state
        button.disabled = false;
        spinner.classList.add('d-none');
        buttonText.textContent = 'Delete Channel';
    }
}

// Update pagination UI
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

    const maxPage = Math.ceil(totalChannels / itemsPerPage) || 1;
    
    // Update button states
    if (firstBtn) firstBtn.disabled = currentPage === 1;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= maxPage || totalChannels === 0;
    if (lastBtn) lastBtn.disabled = currentPage >= maxPage || totalChannels === 0;
    
    // Update current page display
    if (currentPageEl) currentPageEl.textContent = `${currentPage} of ${maxPage}`;
    
    // Update item counts
    const start = totalChannels > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const end = Math.min(currentPage * itemsPerPage, totalChannels);
    
    if (showingStartEl) showingStartEl.textContent = start;
    if (showingEndEl) showingEndEl.textContent = end;
    if (totalCountEl) totalCountEl.textContent = totalChannels;
    if (pageSizeInfoEl) pageSizeInfoEl.textContent = itemsPerPage;
}

// Show/hide loading state
function showLoading(isLoading) {
    if (isLoading) {
        loadingRow.style.display = '';
        emptyState.style.display = 'none';
    } else {
        loadingRow.style.display = 'none';
        if (channels.length === 0) {
            emptyState.style.display = '';
        }
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // You can implement a toast notification system here
    // For now, we'll use a simple alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alert.style.zIndex = '1080';
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}
