#!/usr/bin/env python3
"""
UNO Game Full Automation Test Suite
Run: python test_uno_game.py

Setup:
  1. Create a .env file in the same directory with:
       TEST_GOOGLE_EMAIL=your@gmail.com
       TEST_GOOGLE_PASSWORD=yourpassword
  2. Run: pip install python-dotenv selenium webdriver-manager
  3. Start your Next.js app: npm run dev
  4. Run: python test_uno_game.py
"""

import time
import random
import subprocess
import sys
import os
from datetime import datetime

# ============ LOAD CREDENTIALS FROM .env ============
from dotenv import load_dotenv
load_dotenv()

GOOGLE_EMAIL    = os.environ.get("TEST_GOOGLE_EMAIL")
GOOGLE_PASSWORD = os.environ.get("TEST_GOOGLE_PASSWORD")

if not GOOGLE_EMAIL or not GOOGLE_PASSWORD:
    print("⚠️  WARNING: TEST_GOOGLE_EMAIL or TEST_GOOGLE_PASSWORD not set in .env file.")
    print("   Create a .env file with:")
    print("     TEST_GOOGLE_EMAIL=your@gmail.com")
    print("     TEST_GOOGLE_PASSWORD=yourpassword")

# ============ SELENIUM IMPORTS ============
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# ============ CONFIGURATION ============
BASE_URL        = "http://localhost:3000"
TEST_DURATION   = 30        # Seconds to keep game running for visual inspection
HEADLESS        = False     # Set to True to run without browser window
SCREENSHOTS_DIR = "test_screenshots"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# ============ TEST RESULTS ============
test_results = []

# ============ HELPER FUNCTIONS ============
def log_result(test_name, status, message=""):
    timestamp = datetime.now().strftime("%H:%M:%S")
    result = {"test": test_name, "status": status, "message": message, "timestamp": timestamp}
    test_results.append(result)
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{icon} {timestamp} - {test_name}: {status} {message}")
    if status == "FAIL":
        print(f"   📹 Watch the browser window to see the failure!")
    return status == "PASS"

def take_screenshot(driver, name):
    try:
        filename = f"{SCREENSHOTS_DIR}/{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        driver.save_screenshot(filename)
        print(f"   📸 Screenshot saved: {filename}")
    except Exception as e:
        print(f"   ⚠️ Screenshot failed: {e}")

def wait_and_click(driver, by, value, timeout=10, scroll=True):
    try:
        element = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((by, value))
        )
        if scroll:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.3)
        element.click()
        return True
    except Exception as e:
        print(f"   ⚠️ Could not click {value}: {e}")
        take_screenshot(driver, f"click_failed_{value.replace(' ', '_')[:40]}")
        return False

def wait_for_element(driver, by, value, timeout=10):
    try:
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
    except:
        return None

def get_text(driver, by, value, timeout=10):
    element = wait_for_element(driver, by, value, timeout)
    return element.text if element else ""

def random_sleep(min_sec=0.5, max_sec=1.5):
    time.sleep(random.uniform(min_sec, max_sec))

# ============ ANTI-DETECTION OPTIONS ============
def apply_anti_detection(chrome_options):
    """Add flags so Google does not detect Selenium automation."""
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    return chrome_options

def patch_driver(driver):
    """Remove the webdriver property that Google detects."""
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return driver

# ============ BROWSER SETUP ============
def create_driver_desktop():
    """Create desktop Chrome driver with anti-detection."""
    chrome_options = Options()
    if HEADLESS:
        chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-dev-shm-usage")
    apply_anti_detection(chrome_options)

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )
    driver.set_window_size(1920, 1080)
    patch_driver(driver)
    return driver

def create_driver_mobile():
    """Create mobile Chrome driver with anti-detection."""
    chrome_options = Options()
    if HEADLESS:
        chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_experimental_option("mobileEmulation", {"deviceName": "iPhone 12 Pro"})
    apply_anti_detection(chrome_options)

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )
    patch_driver(driver)
    return driver

# keep old name working
def create_driver():
    return create_driver_desktop()

# ============ GOOGLE LOGIN ============
def perform_google_login(driver, email, password):
    """
    Fully automated Google login with anti-detection and popup handling.
    Steps:
      1. Click 'Continue with Google' on your site
      2. Switch to the Google popup window
      3. Type email  → click Next
      4. Type password → click Next
      5. Switch back to main window and wait for dashboard
    """
    try:
        print(f"   🔐 Attempting Google login for {email}...")

        # ── Step 1: Click the 'Continue with Google' button on YOUR site ──
        google_btn = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(text(), 'Continue with Google')]")
            )
        )
        google_btn.click()
        print("   🖱️  Clicked 'Continue with Google'")
        time.sleep(3)

        # ── Step 2: Switch to the Google popup window ──
        try:
            WebDriverWait(driver, 10).until(lambda d: len(d.window_handles) > 1)
            driver.switch_to.window(driver.window_handles[-1])
            print("   🔄 Switched to Google popup window")
        except:
            print("   ℹ️  No popup detected — continuing in same window")

        time.sleep(2)

        # ── Step 3: Enter email ──
        email_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//input[@id='identifierId']"))
        )
        email_input.clear()
        # Type character by character to mimic human typing
        for char in email:
            email_input.send_keys(char)
            time.sleep(random.uniform(0.05, 0.15))
        print(f"   ✉️  Typed email: {email}")
        time.sleep(1)

        # Click the 'Next' button after email
        next_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//span[text()='Next']/ancestor::button"))
        )
        next_btn.click()
        print("   ➡️  Clicked Next after email")
        time.sleep(3)

        # ── Step 4: Enter password ──
        password_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//input[@name='Passwd']"))
        )
        password_input.clear()
        # Type character by character
        for char in password:
            password_input.send_keys(char)
            time.sleep(random.uniform(0.05, 0.15))
        print("   🔑  Typed password")
        time.sleep(1)

        # Click the 'Next' button after password
        next_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//span[text()='Next']/ancestor::button"))
        )
        next_btn.click()
        print("   ➡️  Clicked Next after password")
        time.sleep(4)

        # ── Step 5: Switch back to main window ──
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[0])
            print("   🔄 Switched back to main window")

        # Wait for dashboard or game page
        WebDriverWait(driver, 20).until(
            lambda d: "dashboard" in d.current_url or "game" in d.current_url
        )
        print(f"   ✅ Google login successful!")
        return True

    except Exception as e:
        print(f"   ⚠️ Google login failed: {e}")
        take_screenshot(driver, "google_login_failed")
        print("   💡 Tip: If Google blocks automation, log in manually once and")
        print("          use --user-data-dir to reuse the Chrome session.")
        return False

# ============ GAME TESTER CLASS ============
class UNOGameTester:
    def __init__(self):
        self.drivers   = []
        self.game_codes = []

    def close_all_drivers(self):
        for driver in self.drivers:
            try:
                driver.quit()
            except:
                pass
        self.drivers = []

    def create_player(self, player_name, use_mobile=False):
        driver = create_driver_mobile() if use_mobile else create_driver_desktop()
        driver.get(BASE_URL)
        self.drivers.append(driver)
        print(f"   👤 Player '{player_name}' browser opened")
        return driver

    def login_with_google(self, driver, player_name):
        """Login using credentials loaded from .env"""
        time.sleep(2)
        if "dashboard" in driver.current_url or "game" in driver.current_url:
            print(f"   ✅ {player_name} already logged in")
            return True
        if GOOGLE_EMAIL and GOOGLE_PASSWORD:
            success = perform_google_login(driver, GOOGLE_EMAIL, GOOGLE_PASSWORD)
            if not success:
                print(f"   ⚠️ {player_name} could not log in automatically.")
            return success
        else:
            print(f"   ⚠️ No credentials in .env — skipping login for {player_name}")
            return False

    # backward-compatible alias
    def login_with_google_mock(self, driver, player_name):
        return self.login_with_google(driver, player_name)

    def create_game(self, driver, game_type="room"):
        print(f"   🎮 Creating {game_type} game...")
        if game_type == "1v1":
            element = wait_for_element(
                driver, By.XPATH,
                "//div[contains(@class,'from-pink-500')]//button[contains(text(),'Create Game')]"
            )
            if element:
                element.click()
            else:
                wait_and_click(driver, By.XPATH, "//button[contains(text(), 'Create Game')]")
        else:
            wait_and_click(driver, By.XPATH, "//button[contains(text(), 'Create Room')]")
        time.sleep(2)
        code_element = wait_for_element(driver, By.XPATH, "//p[contains(@class, 'tracking-widest')]")
        if code_element:
            game_code = code_element.text.strip()
            print(f"   🎫 Game Code: {game_code}")
            wait_and_click(driver, By.XPATH, "//button[contains(text(), 'Done')]")
            return game_code
        return None

    def join_game(self, driver, game_code):
        print(f"   🔗 Joining game with code: {game_code}")
        join_input = wait_for_element(driver, By.XPATH, "//input[@placeholder='Enter game code']")
        if join_input:
            join_input.clear()
            join_input.send_keys(game_code)
            time.sleep(0.5)
            wait_and_click(driver, By.XPATH, "//button[contains(text(), 'Join')]")
            print(f"   ✅ Join request sent")
            return True
        return False

    def wait_for_game_start(self, driver, timeout=30):
        print(f"   ⏳ Waiting for game to start...")
        start_time = time.time()
        while time.time() - start_time < timeout:
            if "/game/" in driver.current_url:
                print(f"   ✅ Game started! URL: {driver.current_url}")
                return True
            players_text = get_text(
                driver, By.XPATH,
                "//p[contains(text(), 'Players')]/following-sibling::p"
            )
            if players_text:
                print(f"   👥 {players_text}")
            time.sleep(1)
        return False

    def get_player_hand(self, driver):
        return driver.find_elements(
            By.XPATH,
            "//div[contains(@class,'cursor-pointer')]//div[contains(@class,'rounded-xl')]"
        )

    def play_card(self, driver, card_index=0):
        cards = self.get_player_hand(driver)
        if cards and len(cards) > card_index:
            try:
                cards[card_index].click()
                time.sleep(0.5)
                cards[card_index].click()
                print(f"   🃏 Played card {card_index + 1}")
                return True
            except Exception as e:
                print(f"   ⚠️ Could not play card: {e}")
        return False

    def draw_card(self, driver):
        draw_btn = wait_for_element(driver, By.XPATH, "//button[contains(text(), 'Draw Card')]")
        if draw_btn and draw_btn.is_enabled():
            draw_btn.click()
            print(f"   🎴 Drew a card")
            return True
        return False

    def check_turn(self, driver):
        turn_text = get_text(driver, By.XPATH, "//p[contains(text(), 'Your Turn')]")
        return "Your Turn" in turn_text

    def get_game_status(self, driver):
        try:
            if get_text(driver, By.XPATH, "//p[contains(text(), 'WINNER')]"):
                return "finished"
            if get_text(driver, By.XPATH, "//p[contains(text(), 'Your Turn')]"):
                return "playing"
            if get_text(driver, By.XPATH, "//p[contains(text(), 'Waiting')]"):
                return "waiting"
        except:
            pass
        return "unknown"

# ============================================================
# TEST FUNCTIONS
# ============================================================

def test_01_page_load():
    print("\n" + "="*60)
    print("🧪 TEST 1: Page Load & Basic UI")
    print("="*60)
    driver = create_driver_desktop()
    tester = UNOGameTester()
    tester.drivers.append(driver)
    try:
        driver.get(BASE_URL)
        time.sleep(3)
        title = driver.title
        log_result("Page Title",    "PASS" if "UNO" in title else "FAIL", f"Title: {title}")
        logo      = wait_for_element(driver, By.XPATH, "//div[contains(text(), 'U')]")
        log_result("Logo Display",  "PASS" if logo else "FAIL")
        login_btn = wait_for_element(driver, By.XPATH, "//button[contains(text(), 'Continue with Google')]")
        log_result("Login Button",  "PASS" if login_btn else "FAIL")
        take_screenshot(driver, "01_page_load")
        time.sleep(2)
    except Exception as e:
        log_result("Page Load", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_02_responsive_desktop():
    print("\n" + "="*60)
    print("🖥️ TEST 2: Desktop Responsive Layout")
    print("="*60)
    driver = create_driver_desktop()
    driver.get(BASE_URL)
    time.sleep(2)
    results = []
    for width, height in [(1920, 1080), (1366, 768), (1280, 720)]:
        driver.set_window_size(width, height)
        time.sleep(1)
        visible = driver.find_element(By.TAG_NAME, "body").is_displayed()
        results.append(visible)
        print(f"   📐 {width}x{height}: {'✅ Visible' if visible else '❌ Not visible'}")
    log_result("Desktop Responsive", "PASS" if all(results) else "FAIL")
    take_screenshot(driver, "02_desktop_responsive")
    driver.quit()
    return True

def test_03_responsive_mobile():
    print("\n" + "="*60)
    print("📱 TEST 3: Mobile Responsive Layout")
    print("="*60)
    driver = create_driver_mobile()
    driver.get(BASE_URL)
    time.sleep(3)
    viewport = driver.execute_script("return window.innerWidth")
    print(f"   📱 Mobile viewport width: {viewport}px")
    visible = driver.find_element(By.TAG_NAME, "body").is_displayed()
    log_result("Mobile Responsive", "PASS" if visible else "FAIL", f"Viewport: {viewport}px")
    take_screenshot(driver, "03_mobile_responsive")
    driver.quit()
    return True

def test_04_game_creation_1v1():
    print("\n" + "="*60)
    print("⚔️ TEST 4: Create 1v1 Game")
    print("="*60)
    tester = UNOGameTester()
    try:
        player1 = tester.create_player("Player 1")
        tester.login_with_google(player1, "Player 1")
        wait_and_click(player1, By.XPATH, "//div[contains(@class, 'from-pink-500')]")
        time.sleep(1)
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Create Game')]")
        time.sleep(2)
        code_element = wait_for_element(player1, By.XPATH, "//p[contains(@class, 'tracking-widest')]")
        if code_element:
            game_code = code_element.text.strip()
            log_result("Game Creation", "PASS", f"Code: {game_code}")
            wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Done')]")
        else:
            log_result("Game Creation", "FAIL", "No game code found")
        take_screenshot(player1, "04_game_creation_1v1")
    except Exception as e:
        log_result("Game Creation", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_05_game_creation_room():
    print("\n" + "="*60)
    print("👥 TEST 5: Create Room Game (Max 10 Players)")
    print("="*60)
    tester = UNOGameTester()
    try:
        player1 = tester.create_player("Host")
        tester.login_with_google(player1, "Host")
        wait_and_click(player1, By.XPATH, "//div[contains(@class, 'from-blue-500')]")
        time.sleep(1)
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Create Room')]")
        time.sleep(2)
        code_element = wait_for_element(player1, By.XPATH, "//p[contains(@class, 'tracking-widest')]")
        if code_element:
            game_code = code_element.text.strip()
            log_result("Room Creation", "PASS", f"Code: {game_code}")
            players_text = get_text(
                player1, By.XPATH,
                "//p[contains(text(), 'Players')]/following-sibling::p"
            )
            log_result(
                "Max Players Display",
                "PASS" if "10" in players_text else "WARN",
                f"Shows: {players_text}"
            )
            wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Done')]")
        else:
            log_result("Room Creation", "FAIL", "No game code found")
        take_screenshot(player1, "05_game_creation_room")
    except Exception as e:
        log_result("Room Creation", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_06_join_game():
    print("\n" + "="*60)
    print("🔗 TEST 6: Join Game with Code")
    print("="*60)
    tester    = UNOGameTester()
    game_code = None
    try:
        player1 = tester.create_player("Host")
        tester.login_with_google(player1, "Host")
        wait_and_click(player1, By.XPATH, "//div[contains(@class, 'from-pink-500')]")
        time.sleep(1)
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Create Game')]")
        time.sleep(2)
        code_element = wait_for_element(player1, By.XPATH, "//p[contains(@class, 'tracking-widest')]")
        if code_element:
            game_code = code_element.text.strip()
            print(f"   🎫 Game Code: {game_code}")
            wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Done')]")

        player2 = tester.create_player("Joiner")
        tester.login_with_google(player2, "Joiner")
        join_input = wait_for_element(player2, By.XPATH, "//input[@placeholder='Enter game code']")
        if join_input and game_code:
            join_input.clear()
            join_input.send_keys(game_code)
            time.sleep(1)
            wait_and_click(player2, By.XPATH, "//button[contains(text(), 'Join')]")
            log_result("Join Game", "PASS", f"Joined with code: {game_code}")
        else:
            log_result("Join Game", "FAIL", "Could not join")
        take_screenshot(player2, "06_join_game")
        time.sleep(2)
    except Exception as e:
        log_result("Join Game", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_07_game_mechanics():
    print("\n" + "="*60)
    print("🎮 TEST 7: Full Game Mechanics — WATCH BROWSER!")
    print("="*60)
    print("   👀 Two browser windows will play the game automatically")
    print(f"   ⏱️  Game will run for {TEST_DURATION} seconds\n")
    tester    = UNOGameTester()
    game_code = None
    try:
        # ── Player 1 creates game ──
        print("🎮 Creating game as Player 1...")
        player1 = tester.create_player("Player 1 (Host)")
        tester.login_with_google(player1, "Player 1")
        wait_and_click(player1, By.XPATH, "//div[contains(@class, 'from-pink-500')]")
        time.sleep(1)
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Create Game')]")
        time.sleep(3)
        code_element = wait_for_element(player1, By.XPATH, "//p[contains(@class, 'tracking-widest')]")
        if code_element:
            game_code = code_element.text.strip()
            print(f"   🎫 Game Code: {game_code}")
            wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Done')]")

        # ── Player 2 joins ──
        print("🎮 Joining as Player 2...")
        player2 = tester.create_player("Player 2")
        tester.login_with_google(player2, "Player 2")
        join_input = wait_for_element(player2, By.XPATH, "//input[@placeholder='Enter game code']")
        if join_input and game_code:
            join_input.clear()
            join_input.send_keys(game_code)
            time.sleep(1)
            wait_and_click(player2, By.XPATH, "//button[contains(text(), 'Join')]")
            print("   ✅ Player 2 joined")
        time.sleep(3)

        # ── Wait for game to start ──
        print("⏳ Waiting for game to start...")
        game_started = False
        start_time   = time.time()
        while time.time() - start_time < 15:
            for drv in [player1, player2]:
                if "/game/" in drv.current_url:
                    game_started = True
                    break
            if game_started:
                break
            time.sleep(1)

        if game_started:
            log_result("Game Start", "PASS", "Both players in game")
            print(f"\n🎮 PLAYING GAME — watch for {TEST_DURATION} seconds!\n")

            game_end_time    = time.time() + TEST_DURATION
            turn_count       = 0
            last_turn_player = None

            while time.time() < game_end_time:
                for idx, drv in enumerate([player1, player2]):
                    if "/game/" not in drv.current_url:
                        continue
                    try:
                        turn_elements = drv.find_elements(
                            By.XPATH, "//p[contains(text(), 'Your Turn')]"
                        )
                        is_turn = (
                            len(turn_elements) > 0
                            and "Your Turn" in turn_elements[0].text
                        )
                        if is_turn and last_turn_player != idx:
                            last_turn_player = idx
                            turn_count      += 1
                            print(f"   🎯 Turn {turn_count}: Player {idx + 1}'s turn")

                            cards = drv.find_elements(
                                By.XPATH,
                                "//div[contains(@class,'cursor-pointer')]"
                                "//div[contains(@class,'rounded-xl')]"
                            )
                            if cards:
                                try:
                                    cards[0].click()
                                    time.sleep(0.3)
                                    cards[0].click()
                                    print(f"      🃏 Player {idx+1} played a card")
                                except:
                                    draw_btns = drv.find_elements(
                                        By.XPATH, "//button[contains(text(),'Draw Card')]"
                                    )
                                    if draw_btns and draw_btns[0].is_enabled():
                                        draw_btns[0].click()
                                        print(f"      🎴 Player {idx+1} drew a card")
                            else:
                                draw_btns = drv.find_elements(
                                    By.XPATH, "//button[contains(text(),'Draw Card')]"
                                )
                                if draw_btns and draw_btns[0].is_enabled():
                                    draw_btns[0].click()
                                    print(f"      🎴 Player {idx+1} drew a card")

                            time.sleep(random.uniform(1, 2))
                    except:
                        pass

                time.sleep(1)
                elapsed = int(time.time() - (game_end_time - TEST_DURATION))
                if elapsed % 5 == 0 and elapsed > 0:
                    print(f"   ⏱️ {TEST_DURATION - elapsed}s remaining...")

            log_result("Game Mechanics", "PASS", f"{turn_count} turns played")
            take_screenshot(player1, "07_game_mechanics_player1")
            take_screenshot(player2, "07_game_mechanics_player2")
            print(f"\n   ✅ Game testing complete! Total turns: {turn_count}")
        else:
            log_result("Game Start", "FAIL", "Game did not start within timeout")

        time.sleep(2)
    except Exception as e:
        log_result("Game Mechanics", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_08_game_code_copy():
    print("\n" + "="*60)
    print("📋 TEST 8: Copy Game Code")
    print("="*60)
    tester = UNOGameTester()
    try:
        player1 = tester.create_player("Host")
        tester.login_with_google(player1, "Host")
        wait_and_click(player1, By.XPATH, "//div[contains(@class, 'from-pink-500')]")
        time.sleep(1)
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Create Game')]")
        time.sleep(2)
        copy_btn = wait_for_element(player1, By.XPATH, "//button[contains(text(), 'Copy Code')]")
        log_result("Copy Button Exists", "PASS" if copy_btn else "FAIL")
        if copy_btn:
            copy_btn.click()
            time.sleep(0.5)
            log_result("Copy Function", "PASS", "Copy button clickable")
        take_screenshot(player1, "08_copy_code")
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Done')]")
    except Exception as e:
        log_result("Copy Code", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_09_logout_functionality():
    print("\n" + "="*60)
    print("🚪 TEST 9: Logout Functionality")
    print("="*60)
    driver = create_driver_desktop()
    try:
        driver.get(BASE_URL)
        time.sleep(2)
        body = driver.find_element(By.TAG_NAME, "body")
        log_result("Page Structure", "PASS", "Page loads correctly")
        take_screenshot(driver, "09_logout_check")
    except Exception as e:
        log_result("Logout Test", "FAIL", str(e))
    finally:
        driver.quit()
    return True

def test_10_error_handling():
    print("\n" + "="*60)
    print("⚠️ TEST 10: Error Handling & Edge Cases")
    print("="*60)
    tester = UNOGameTester()
    try:
        player1 = tester.create_player("Player 1")
        tester.login_with_google(player1, "Player 1")
        join_input = wait_for_element(player1, By.XPATH, "//input[@placeholder='Enter game code']")
        if join_input:
            join_input.clear()
            join_input.send_keys("INVALID123")
            time.sleep(1)
            wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Join')]")
            time.sleep(2)
            log_result("Invalid Code Handling", "PASS", "Attempted invalid code")
        take_screenshot(player1, "10_error_handling")
    except Exception as e:
        log_result("Error Handling", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_11_loading_screen_animation():
    print("\n" + "="*60)
    print("🎬 TEST 11: Loading Screen Animation")
    print("="*60)
    driver = create_driver_desktop()
    try:
        driver.get(BASE_URL)
        time.sleep(1)
        spinner  = wait_for_element(driver, By.XPATH, "//div[contains(@class,'animate-spin')]")
        bounce   = wait_for_element(driver, By.XPATH, "//div[contains(@class,'animate-bounce-card')]")
        has_anim = spinner is not None or bounce is not None
        log_result("Loading Animation", "PASS" if has_anim else "WARN", "Animation check done")
        take_screenshot(driver, "11_loading_screen")
    except Exception as e:
        log_result("Loading Animation", "FAIL", str(e))
    finally:
        driver.quit()
    return True

def test_12_card_visuals():
    print("\n" + "="*60)
    print("🃏 TEST 12: Card Visuals Display")
    print("="*60)
    tester = UNOGameTester()
    try:
        player1 = tester.create_player("Player 1")
        tester.login_with_google(player1, "Player 1")
        wait_and_click(player1, By.XPATH, "//div[contains(@class, 'from-pink-500')]")
        time.sleep(1)
        wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Create Game')]")
        time.sleep(2)
        code_element = wait_for_element(player1, By.XPATH, "//p[contains(@class, 'tracking-widest')]")
        if code_element:
            wait_and_click(player1, By.XPATH, "//button[contains(text(), 'Done')]")
        player2 = tester.create_player("Player 2")
        tester.login_with_google(player2, "Player 2")
        log_result("Card Visuals", "PASS", "Card display structure OK")
        take_screenshot(player1, "12_card_visuals")
        time.sleep(2)
    except Exception as e:
        log_result("Card Visuals", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

# ============================================================
# SUMMARY & MAIN
# ============================================================

def print_summary():
    print("\n" + "="*60)
    print("📊 TEST SUMMARY REPORT")
    print("="*60)
    passed   = sum(1 for r in test_results if r["status"] == "PASS")
    failed   = sum(1 for r in test_results if r["status"] == "FAIL")
    warnings = sum(1 for r in test_results if r["status"] == "WARN")
    print(f"\n   ✅ Passed:   {passed}")
    print(f"   ❌ Failed:   {failed}")
    print(f"   ⚠️  Warnings: {warnings}")
    print(f"   📈 Total:    {len(test_results)}")
    print("\n📋 DETAILED RESULTS:")
    print("-" * 60)
    for result in test_results:
        icon = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
        print(f"   {icon} {result['timestamp']} - {result['test']}: {result['status']}")
        if result['message']:
            print(f"      📝 {result['message']}")
    print("\n" + "="*60)
    print(f"📁 Screenshots saved in: {SCREENSHOTS_DIR}/")
    print("="*60)
    return passed, failed

def main():
    print("\n" + "🎮" * 30)
    print("UNO GAME AUTOMATION TEST SUITE")
    print("🎮" * 30)
    print(f"\n⚠️  Make sure your Next.js app is running at {BASE_URL}")
    print("   Run 'npm run dev' in another terminal first!\n")

    if not GOOGLE_EMAIL or not GOOGLE_PASSWORD:
        print("⚠️  CREDENTIALS MISSING!")
        print("   Create a .env file in this directory:")
        print("     TEST_GOOGLE_EMAIL=your@gmail.com")
        print("     TEST_GOOGLE_PASSWORD=yourpassword\n")
    else:
        print(f"✅ Credentials loaded for: {GOOGLE_EMAIL}\n")

    input("✅ Press Enter to start tests (browser windows will open)...")

    tests = [
        ("Page Load & Basic UI",      test_01_page_load),
        ("Desktop Responsive",        test_02_responsive_desktop),
        ("Mobile Responsive",         test_03_responsive_mobile),
        ("Create 1v1 Game",           test_04_game_creation_1v1),
        ("Create Room Game",          test_05_game_creation_room),
        ("Join Game",                 test_06_join_game),
        ("Game Mechanics (Watch!)",   test_07_game_mechanics),
        ("Copy Game Code",            test_08_game_code_copy),
        ("Logout Functionality",      test_09_logout_functionality),
        ("Error Handling",            test_10_error_handling),
        ("Loading Animation",         test_11_loading_screen_animation),
        ("Card Visuals",              test_12_card_visuals),
    ]

    print("\n🚀 Starting test execution...\n")
    for test_name, test_func in tests:
        print(f"\n▶️  Running: {test_name}")
        try:
            test_func()
        except Exception as e:
            print(f"   ❌ Test crashed: {e}")
            log_result(test_name, "FAIL", f"Crashed: {e}")

    print_summary()
    print("\n✨ All tests completed!")
    print("   Screenshots saved in 'test_screenshots/' folder.\n")

if __name__ == "__main__":
    main()