async function fetchChannels() {
    const jwtToken = localStorage.getItem('jwt_token');
    const res = await fetch('/api/youtube/list-channels', {
        headers: { 'Authorization': 'Bearer ' + jwtToken }
    });
    const data = await res.json();
    const tbody = document.querySelector('#channels-table tbody');
    tbody.innerHTML = '';
    if (data.channels) {
        document.getElementById('countChannels').textContent = data.channels.length;
        data.channels.forEach(channel => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${channel.ID}</td>
                <td><span class="monitor-title-ellipsis" title="${channel.ChannelName}">${channel.ChannelName}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger delete-channel-btn" id="delete-channel-${channel.ID}" data-unique-id="${channel.ID}">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        document.getElementById('countChannels').textContent = '0';
    }
}


// --- Channel logic ---
// handle add channel
$('#add-channel-form').submit(async function(e) {
    e.preventDefault();
    const jwtToken = localStorage.getItem('jwt_token');
    resp = await fetch('/api/youtube/authorize', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
    });
    // open auth url in bootstrap dialog modal
    const authUrl = await resp.json();

    // $('#authorizeModal').modal('show');
    // $('#authorizeModal').find('.modal-body').html('<iframe src="' + authUrl.auth_url + '" width="100%" height="600px"></iframe>');
    window.open(authUrl.auth_url, '_blank');
});

// handle remove channel
$('#channels-table').on('click', '.delete-channel-btn', async function() {
    const uniqueId = $(this).data('unique-id');
    await removeChannel(uniqueId);
    fetchChannels();
});

async function removeChannel(uniqueId) {
    if (!confirm('Remove this channel?')) return;
    const jwtToken = localStorage.getItem('jwt_token');
    await fetch('/api/youtube/channels/' + uniqueId, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwtToken },
    });
    fetchChannels();
}

document.addEventListener('DOMContentLoaded', function() {
    fetchChannels();
});

