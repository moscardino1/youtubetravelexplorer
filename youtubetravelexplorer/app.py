from flask import Flask, render_template, jsonify, request
import os
import logging
from googleapiclient.discovery import build
from dotenv import load_dotenv
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Also log to a file
file_handler = logging.FileHandler('app.log')
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

load_dotenv()

app = Flask(__name__)

YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
if not YOUTUBE_API_KEY:
    logger.error("No YouTube API key found in environment variables!")
else:
    logger.info("YouTube API key loaded successfully (key not shown for security reasons)")

try:
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    logger.info("YouTube API client built successfully")
except Exception as e:
    logger.error(f"Failed to build YouTube API client: {str(e)}")

@app.route('/')
def index():
    logger.info("Homepage accessed")
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search_videos():
    logger.info("Search endpoint accessed")
    
    # Log incoming request data
    data = request.get_json()
    logger.info(f"Received search request with data: {data}")
    
    country = data.get('country')
    language = data.get('language', 'English')
    category = data.get('category', 'travel vlog')
    
    search_query = f"{country} {language} {category}"
    logger.info(f"Constructed search query: {search_query}")
    
    try:
        logger.info("Preparing YouTube API request")
        youtube_request = youtube.search().list(
            part="snippet",
            q=search_query,
            type="video",
            maxResults=10,
            relevanceLanguage=language[:2] if len(language) >= 2 else 'en'
        )
        
        logger.info("Executing YouTube API request")
        response = youtube_request.execute()
        logger.info(f"Received {len(response.get('items', []))} results from YouTube API")
        
        # Log the raw response for debugging
        logger.debug(f"Raw YouTube API response: {response}")
        
        videos = []
        for item in response.get('items', []):
            try:
                video_data = {
                    'title': item['snippet']['title'],
                    'videoId': item['id']['videoId'],
                    'thumbnail': item['snippet']['thumbnails']['medium']['url'],
                    'channelTitle': item['snippet']['channelTitle'],
                    'publishedAt': item['snippet']['publishedAt'],
                    'description': item['snippet']['description'][:100] + '...'  # First 100 chars of description
                }
                videos.append(video_data)
                logger.debug(f"Processed video: {video_data['title']}")
            except KeyError as ke:
                logger.error(f"Missing key in video data: {ke}")
                continue
        
        logger.info(f"Successfully processed {len(videos)} videos")
        return jsonify({
            'videos': videos,
            'query': search_query,
            'timestamp': datetime.now().isoformat(),
            'total_results': len(videos)
        })
        
    except Exception as e:
        logger.error(f"Error during YouTube API request: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'query': search_query,
            'timestamp': datetime.now().isoformat()
        }), 500

# Add request logging middleware
@app.before_request
def log_request_info():
    logger.debug('Headers: %s', request.headers)
    logger.debug('Body: %s', request.get_data())

# Add response logging middleware
@app.after_request
def log_response_info(response):
    logger.debug('Response Status: %s', response.status)
    logger.debug('Response Headers: %s', response.headers)
    return response

if __name__ == '__main__':
    logger.info("Starting application")
    app.run(debug=True)