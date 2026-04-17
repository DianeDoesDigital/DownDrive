from flask import Flask, request, jsonify, render_template, send_file
import yt_dlp
import os
import threading

app = Flask(__name__)
# Cloud servers use Linux, we save in /tmp for fast, safe temporary storage.
DOWNLOAD_FOLDER = '/tmp/downloads' if os.name != 'nt' else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

progress_data = {}

def my_hook(d):
    status = d.get('status')
    video_id = d.get('info_dict', {}).get('id', 'unknown')
    
    if status == 'downloading':
        progress_data[video_id] = {
            'status': 'downloading',
            'percent': d.get('_percent_str', '0%').strip(),
            'speed': d.get('_speed_str', '-- MiB/s').strip(),
            'eta': d.get('_eta_str', '--:--').strip(),
            'filepath': progress_data.get(video_id, {}).get('filepath')
        }
    elif status == 'finished':
        progress_data[video_id]['status'] = 'processing'
        progress_data[video_id]['percent'] = '100%'
        progress_data[video_id]['filepath'] = d.get('filename')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    format_option = data.get('format', 'video')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        # Intelligently resolve the format depending on if user wants Audio or Video
        target_format = 'bestaudio/best' if format_option == 'audio' else 'best[ext=mp4]/best/b'

        ydl_opts = {
            'outtmpl': os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s'),
            'progress_hooks': [my_hook],
            'nocheckcertificate': True,
            'quiet': True,
            'no_warnings': True,
            'format': target_format,
            # Bypass YouTube's aggressive datacenter bot-checks by disguising as a mobile app
            'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
            'geo_bypass': True
        }

        # If a cookies file is present, inject it to completely obliterate YouTube bot-blocks!
        if os.path.exists('cookies.txt'):
            ydl_opts['cookiefile'] = 'cookies.txt'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            video_id = info.get('id', 'unknown')
            title = info.get('title', 'Unknown Media')

            progress_data[video_id] = {
                'status': 'starting',
                'percent': '0%',
                'speed': '--',
                'eta': '--',
                'filepath': None
            }

            def background_download():
                try:
                    ydl.download([url])
                    progress_data[video_id]['status'] = 'completed'
                except Exception as e:
                    progress_data[video_id]['status'] = 'error'
                    progress_data[video_id]['error_msg'] = str(e)

            thread = threading.Thread(target=background_download)
            thread.start()

            return jsonify({
                'message': 'Extraction started',
                'video_id': video_id,
                'title': title
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/progress/<video_id>')
def get_progress(video_id):
    data = progress_data.get(video_id, {'status': 'not_found'})
    return jsonify(data)

@app.route('/api/download_file/<video_id>')
def download_file(video_id):
    data = progress_data.get(video_id)
    if data and data.get('filepath') and os.path.exists(data['filepath']):
        return send_file(data['filepath'], as_attachment=True)
    return "File not found or expired on server.", 404

if __name__ == '__main__':
    # 0.0.0.0 makes it accessible on the internet when deployed
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)
