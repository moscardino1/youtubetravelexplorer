
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import json
import time
from datetime import datetime
import os

class YouTubeScraper:
    def __init__(self, headless=True):
        """Initialize the scraper with optional headless mode."""
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.cache_file = 'youtube_search_cache.json'
        self.load_cache()

    def load_cache(self):
        """Load cached results from file."""
        try:
            with open(self.cache_file, 'r') as f:
                self.cache = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.cache = {}

    def save_cache(self):
        """Save results to cache file."""
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f)

    def get_cache_key(self, location, city, topic):
        """Generate a unique cache key."""
        return f"{location.lower()}-{city.lower()}-{topic.lower()}"

    def is_cache_valid(self, timestamp, max_age_hours=24):
        """Check if cached results are still valid."""
        if not timestamp:
            return False
        age = (datetime.now() - datetime.fromtimestamp(timestamp)).total_seconds() / 3600
        return age < max_age_hours

    def find_videos(self, location, city, topic, max_results=10):
        """
        Find videos based on location, city and topic.
        Returns a list of dictionaries containing video information.
        """
        cache_key = self.get_cache_key(location, city, topic)
        
        # Check cache first
        if cache_key in self.cache:
            cached_data = self.cache[cache_key]
            if self.is_cache_valid(cached_data.get('timestamp')):
                print("Returning cached results")
                return cached_data['videos']

        try:
            # Construct search query and URL
            query = f"{location} {city} {topic}"
            url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
            
            self.driver.get(url)
            time.sleep(3)  # Wait for dynamic content to load
            
            # Scroll to load more videos
            scroll_pause_time = 1
            scrolls = 3  # Adjust this number to control how many times to scroll
            
            for _ in range(scrolls):
                self.driver.find_element(By.TAG_NAME, 'body').send_keys(Keys.END)
                time.sleep(scroll_pause_time)

            # Wait for video elements to be present
            wait = WebDriverWait(self.driver, 10)
            video_elements = wait.until(EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, "ytd-video-renderer")
            ))

            videos = []
            for element in video_elements[:max_results]:
                try:
                    # Extract video information
                    title_element = element.find_element(By.CSS_SELECTOR, "#video-title")
                    channel_element = element.find_element(By.CSS_SELECTOR, "#channel-info a")
                    
                    video_data = {
                        'title': title_element.get_attribute('title'),
                        'url': title_element.get_attribute('href'),
                        'channel': channel_element.text,
                        'thumbnail': element.find_element(
                            By.CSS_SELECTOR, "#thumbnail img"
                        ).get_attribute('src'),
                    }
                    
                    # Only add if we have valid URL
                    if video_data['url']:
                        videos.append(video_data)
                        
                except Exception as e:
                    print(f"Error extracting video data: {str(e)}")
                    continue

            # Cache the results
            self.cache[cache_key] = {
                'videos': videos,
                'timestamp': datetime.now().timestamp()
            }
            self.save_cache()

            return videos

        except Exception as e:
            print(f"Error during scraping: {str(e)}")
            if cache_key in self.cache:
                print("Returning cached results due to error")
                return self.cache[cache_key]['videos']
            raise

    def close(self):
        """Close the browser."""
        self.driver.quit()

def main():
    # Example usage
    scraper = YouTubeScraper(headless=True)
    try:
        results = scraper.find_videos("France", "Paris", "tourism")
        for i, video in enumerate(results, 1):
            print(f"\n{i}. {video['title']}")
            print(f"URL: {video['url']}")
            print(f"Channel: {video['channel']}")
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        scraper.close()

if __name__ == "__main__":
    main()