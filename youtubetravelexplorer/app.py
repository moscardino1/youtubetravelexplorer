from flask import Flask, render_template, jsonify, request, abort
import os
import logging
from googleapiclient.discovery import build
from dotenv import load_dotenv
from datetime import datetime
import qrcode
import base64
from io import BytesIO

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

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
def home():
    return render_template('index.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/info')
def info():
    return render_template('info.html')

@app.route('/search', methods=['POST'])
def search_videos():
    data = request.get_json()
    
    # Validate incoming data
    if not data or 'country' not in data or 'language' not in data:
        abort(400)  # Bad request if required fields are missing

    country = data['country']
    language = data['language']
    category = data.get('category', 'travel vlog')  # Default category
    city = data.get('city', '')  # Get city from the request

    # Construct the search query to include the city
    search_query = f"{city}, {country} {language} {category}" if city else f"{country} {language} {category}"
    
    logger.info("Search endpoint accessed")
    logger.info(f"Received search request with data: {data}")
    logger.info(f"Constructed search query: {search_query}")
    
    try:
        logger.info("Preparing YouTube API request")
        youtube_request = youtube.search().list(
            part="snippet",
            q=search_query,
            type="video",
            maxResults=5,
            relevanceLanguage=language[:2] if len(language) >= 2 else 'en'
        )
        
        logger.info("Executing YouTube API request")
        response =  youtube_request.execute()
        logger.info(f"Received {len(response.get('items', []))} results from YouTube API")
        
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

@app.route('/donate')
def donate():
    USDT_ADDRESS = "0xDC92534Be92780c87f232CD525D99e26892E15f7"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(USDT_ADDRESS)
    qr.make(fit=True)

    # Create an image from the QR Code instance
    img = qr.make_image(fill_color="black", back_color="white")

    # Save the image to a BytesIO object
    buffered = BytesIO()
    img.save(buffered, format="PNG")

    # Encode the image to Base64
    qr_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    return render_template('donate.html', usdt_address=USDT_ADDRESS, qr_image=qr_image)

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