import json
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

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

    def find_videos(self, location, city, topic, max_results=10):
        """
        Find videos based on location, city and topic.
        Returns a list of dictionaries containing video information.
        """
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

            return videos

        except Exception as e:
            print(f"Error during scraping: {str(e)}")
            return []

    def close(self):
        """Close the browser."""
        self.driver.quit()

class VideoAPIManager:
    def __init__(self):
        self.scraper = YouTubeScraper(headless=True)

    def search_youtube(self, query, language='en', category='travel vlog', city=None):
        """Search YouTube for videos based on the query."""
        location = query.split(",")[0] if city else query
        city = query.split(",")[1] if city else ""
        topic = category
        
        videos = self.scraper.find_videos(location, city, topic)
        return videos

    def close(self):
        """Close the scraper."""
        self.scraper.close()
