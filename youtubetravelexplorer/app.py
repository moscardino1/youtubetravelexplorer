from flask import Flask, render_template, jsonify, request, abort
import os
import logging
from dotenv import load_dotenv
from video_api_manager_bs import VideoAPIManager  # Import the new module
# from video_api_manager_API import VideoAPIManager  # Import the new module
from io import BytesIO
from datetime import datetime
import qrcode
import base64
import requests

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
video_api_manager = VideoAPIManager()  # Initialize the video API manager

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
    city = data.get('city', None)  # Get city from the request

    # Construct the search query to include the city
    search_query = f"{city}, {country} {language} {category}" if city else f"{country} {language} {category}"
    
    logger.info("Search endpoint accessed")
    logger.info(f"Received search request with data: {data}")
    logger.info(f"Constructed search query: {search_query}")
    
    try:
        # Call the video API manager to search for videos
        youtube_videos = video_api_manager.search_youtube(search_query, language, category)
        logger.info(f"YouTube videos found: {len(youtube_videos)}")  # Log the number of videos found

        # Combine results from all sources
        videos = {
            'youtube': youtube_videos,

        }

        return jsonify({
            'videos': videos,
            'query': search_query,
            'timestamp': datetime.now().isoformat(),
            'total_results': {
                'youtube': len(youtube_videos),

            }
        })
        
    except Exception as e:
        logger.error(f"Error during video search: {str(e)}", exc_info=True)
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

from urllib.parse import quote

@app.route('/wiki-summary/<title>', methods=['GET'])
def wiki_summary(title):
    try:
        # URL-encode the title to handle spaces and special characters
        encoded_title = quote(title)

        # Construct the Wikipedia API URL
        wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles={encoded_title}"
        
        # Fetch the data from Wikipedia
        response = requests.get(wiki_url)
        
        # If the request is successful
        if response.status_code == 200:
            data = response.json()
            pages = data['query']['pages']
            page = list(pages.values())[0]  # Get the first page result
            summary = page.get('extract', 'No summary available.')
            
            # Return the summary as JSON
            return jsonify({
                'summary': summary,
                'title': title
            })
        else:
            return jsonify({'error': 'Error fetching Wikipedia data'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to fetch Wikipedia data: {str(e)}'}), 500


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