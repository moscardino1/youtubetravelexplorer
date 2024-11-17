import os
import requests
from googleapiclient.discovery import build
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
class VideoAPIManager:
    def __init__(self):
        self.youtube_api_key = os.getenv('YOUTUBE_API_KEY')
        self.youtube = None
        if self.youtube_api_key:
            self.youtube = build('youtube', 'v3', developerKey=self.youtube_api_key)

    def search_youtube(self, query, language='en', category='travel vlog'):
        if not self.youtube:
            raise Exception("YouTube API client not initialized.")
        
        youtube_request = self.youtube.search().list(
            part="snippet",
            q=query,
            type="video",
            maxResults=5,
            relevanceLanguage=language[:2] if len(language) >= 2 else 'en'
        )
        response = youtube_request.execute()
        return self.format_youtube_response(response)

    def format_youtube_response(self, response):
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
            except KeyError:
                continue
        return videos  # Return an empty list if no videos found


# Example usage
if __name__ == "__main__":
    manager = VideoAPIManager()
    print(manager.search_youtube("Python programming"))
