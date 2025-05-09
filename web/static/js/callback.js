function callback() {
    const jwtToken = localStorage.getItem('jwtToken');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    resp = $.ajax({
        url: '/api/youtube/callback?code=' + code + '&state=' + state,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + jwtToken },
        success: function(data) {
            console.log(data);
            if (data.status === 'success') {
                $('#result').text(data.message + ' in 5 seconds redirect to channels').addClass('text-success');
                // after 5 seconds redirect to channels
                setTimeout(function() {
                    window.location.href = '/channels';
                }, 5000);
            } 
        },
        error: function() {
            $('#result').text('Failed to callback').addClass('text-danger');
        }
    });
}

$(document).ready(function() {
    callback();
});

