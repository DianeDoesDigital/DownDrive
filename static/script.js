document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url');
    const downloadBtn = document.getElementById('download-btn');
    const statusPanel = document.getElementById('status-panel');
    const videoTitle = document.getElementById('video-title');
    const progressBar = document.getElementById('progress-bar');
    const percentTxt = document.getElementById('percent');
    const speedTxt = document.getElementById('speed');
    const etaTxt = document.getElementById('eta');
    const statusTxt = document.getElementById('status-text');

    let isPolling = false;

    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please drop a valid URL target.');
            return;
        }

        const format = document.querySelector('input[name="format"]:checked').value;
        
        // Reset UI
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Initializing...</span>';
        
        statusPanel.classList.remove('hidden');
        statusPanel.style.position = 'relative'; 
        videoTitle.textContent = "Analyzing media node...";
        progressBar.style.width = '0%';
        percentTxt.textContent = '0%';
        speedTxt.textContent = '--';
        etaTxt.textContent = '--:--';
        statusTxt.textContent = 'Contacting server...';

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Server rejected extraction');
            }

            videoTitle.textContent = data.title;
            const videoId = data.video_id;
            
            isPolling = true;
            pollProgress(videoId);

        } catch (error) {
            statusTxt.textContent = 'Status: FAILED';
            statusTxt.style.color = '#ef4444';
            let formattedErr = error.message;
            if (formattedErr.length > 200) {
                formattedErr = formattedErr.substring(0, 150) + "... [Error truncated. It looks like this specific video might be geo-restricted or blocked in this region.]";
            }
            alert('Error: ' + formattedErr);
            resetBtn();
        }
    });

    async function pollProgress(videoId) {
        if (!isPolling) return;

        try {
            const res = await fetch(`/api/progress/${videoId}`);
            const data = await res.json();

            if (data.status === 'downloading') {
                statusTxt.textContent = 'Extracting data streams...';
                
                const cleanPercent = data.percent.replace(/\x1b\[[0-9;]*m/g, '').trim();
                const cleanSpeed = data.speed.replace(/\x1b\[[0-9;]*m/g, '').trim();
                const cleanEta = data.eta.replace(/\x1b\[[0-9;]*m/g, '').trim();

                let pBarVal = cleanPercent.replace('%', '');
                progressBar.style.width = `${pBarVal}%`;
                
                percentTxt.textContent = cleanPercent || '0%';
                speedTxt.textContent = cleanSpeed || '--';
                etaTxt.textContent = cleanEta || '--:--';

                setTimeout(() => pollProgress(videoId), 1000);
            } 
            else if (data.status === 'completed' || data.status === 'processing') {
                if (data.status === 'completed') {
                    isPolling = false;
                    progressBar.style.width = '100%';
                    percentTxt.textContent = '100%';
                    speedTxt.textContent = '0 B/s';
                    etaTxt.textContent = '00:00';
                    
                    statusTxt.textContent = 'Pushing payload to your browser...';
                    statusTxt.style.color = '#10b981'; 
                    downloadBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Target Acquired</span>';
                    
                    // Trigger download directly to user's real browser
                    window.location.href = '/api/download_file/' + videoId;
                    
                    setTimeout(() => {
                        resetBtn();
                    }, 5000);
                } else {
                     setTimeout(() => pollProgress(videoId), 1000);
                }
            }
            else if (data.status === 'error') {
                isPolling = false;
                statusTxt.textContent = 'System Error: Extraction failed';
                statusTxt.style.color = '#ef4444';
                resetBtn();
            }
            else {
                setTimeout(() => pollProgress(videoId), 1500);
            }
        } catch (error) {
            console.error("Polling error:", error);
            setTimeout(() => pollProgress(videoId), 2000);
        }
    }

    function resetBtn() {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span>Extract Source</span> <i class="fa-solid fa-arrow-down"></i>';
        setTimeout(() => {
            statusTxt.style.color = 'var(--accent)';
        }, 1000);
    }
});
