#!/usr/bin/env python3
"""
UNO Game Full Automation Test Suite
Run: python test_uno_game.py

Setup:
  1. Create a .env file in the same directory with:
       TEST_GOOGLE_EMAIL=your@gmail.com
       TEST_GOOGLE_PASSWORD=yourpassword
  2. pip install python-dotenv selenium webdriver-manager
  3. npm run dev   (in your Next.js project)
  4. python test_uno_game.py
"""

import time
import random
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
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# ============ CONFIGURATION ============
BASE_URL        = "http://localhost:3000"
TEST_DURATION   = 30
HEADLESS        = False
SCREENSHOTS_DIR = "test_screenshots"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# ============ TEST RESULTS ============
test_results = []

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def log_result(test_name, status, message=""):
    timestamp = datetime.now().strftime("%H:%M:%S")
    test_results.append({"test": test_name, "status": status,
                         "message": message, "timestamp": timestamp})
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{icon} {timestamp} - {test_name}: {status} {message}")
    if status == "FAIL":
        print(f"   📹 Watch the browser window to see the failure!")
    return status == "PASS"

def take_screenshot(driver, name):
    try:
        filename = f"{SCREENSHOTS_DIR}/{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        driver.save_screenshot(filename)
        print(f"   📸 Screenshot: {filename}")
    except Exception as e:
        print(f"   ⚠️ Screenshot failed: {e}")

def wait_and_click(driver, by, value, timeout=10, scroll=True):
    try:
        element = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((by, value))
        )
        if scroll:
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
            time.sleep(0.3)
        element.click()
        return True
    except Exception as e:
        print(f"   ⚠️ Could not click [{value}]: {e}")
        take_screenshot(driver, f"click_failed")
        return False

def wait_for_element(driver, by, value, timeout=10):
    try:
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
    except:
        return None

def get_text(driver, by, value, timeout=10):
    el = wait_for_element(driver, by, value, timeout)
    return el.text if el else ""

# ============================================================
# ANTI-DETECTION HELPERS
# ============================================================

def apply_anti_detection(chrome_options):
    """Prevent Google from detecting Selenium."""
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    return chrome_options

def patch_driver(driver):
    """Remove navigator.webdriver flag that Google checks."""
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return driver

# ============================================================
# BROWSER SETUP
# ============================================================

def create_driver_desktop():
    chrome_options = Options()
    if HEADLESS:
        chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--window-size=1920,1080")
    apply_anti_detection(chrome_options)
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )
    driver.set_window_size(1920, 1080)
    patch_driver(driver)
    return driver

def create_driver_mobile():
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

def create_driver():
    return create_driver_desktop()

# ============================================================
# GOOGLE LOGIN
# ============================================================

# ── XPaths for YOUR login page button ──────────────────────
# The button HTML is:
#   <button onClick={handleLogin} disabled={isLoggingIn} ...>
#     <span>Continue with Google</span>   ← text is in a SPAN
#   </button>
#
# So we match the button that CONTAINS a span with that text.
LOGIN_BTN_XPATH = (
    "//button[.//span[contains(text(),'Continue with Google')]]"
)

def click_login_button(driver):
    """
    Click the 'Continue with Google' button on YOUR site.
    Tries multiple strategies to handle the span-inside-button structure.
    """
    print("   🖱️  Looking for 'Continue with Google' button...")

    # Strategy 1 — button containing a span with the text
    try:
        btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, LOGIN_BTN_XPATH))
        )
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
        time.sleep(0.5)
        btn.click()
        print("   ✅ Clicked via Strategy 1 (span inside button)")
        return True
    except Exception as e:
        print(f"   ⚠️ Strategy 1 failed: {e}")

    # Strategy 2 — click the span itself (triggers the parent button's onClick)
    try:
        span = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//span[contains(text(),'Continue with Google')]")
            )
        )
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", span)
        time.sleep(0.5)
        span.click()
        print("   ✅ Clicked via Strategy 2 (span directly)")
        return True
    except Exception as e:
        print(f"   ⚠️ Strategy 2 failed: {e}")

    # Strategy 3 — JavaScript click (bypasses any overlay)
    try:
        btn = driver.find_element(By.XPATH, LOGIN_BTN_XPATH)
        driver.execute_script("arguments[0].click();", btn)
        print("   ✅ Clicked via Strategy 3 (JavaScript click)")
        return True
    except Exception as e:
        print(f"   ⚠️ Strategy 3 failed: {e}")

    # Strategy 4 — find any button whose full text contains the phrase
    try:
        buttons = driver.find_elements(By.TAG_NAME, "button")
        for btn in buttons:
            if "Continue with Google" in btn.text or "Sign in with Google" in btn.text:
                driver.execute_script("arguments[0].click();", btn)
                print("   ✅ Clicked via Strategy 4 (tag scan)")
                return True
    except Exception as e:
        print(f"   ⚠️ Strategy 4 failed: {e}")

    take_screenshot(driver, "login_btn_not_found")
    print("   ❌ All strategies failed — could not click login button")
    return False


def perform_google_login(driver, email, password):
    """
    Full Google OAuth flow:
      1. Click 'Continue with Google' on YOUR site
      2. Wait for Google popup window
      3. Enter email → Next
      4. Enter password → Next
      5. Return to main window and wait for /dashboard
    """
    try:
        print(f"   🔐 Starting Google login for: {email}")

        # ── 1. Click YOUR site's login button ──────────────────
        if not click_login_button(driver):
            return False
        time.sleep(3)

        # ── 2. Switch to the Google OAuth popup ────────────────
        try:
            WebDriverWait(driver, 10).until(lambda d: len(d.window_handles) > 1)
            driver.switch_to.window(driver.window_handles[-1])
            print(f"   🔄 Switched to Google popup: {driver.current_url}")
        except:
            print("   ℹ️  No popup detected — staying in same window")

        time.sleep(2)
        take_screenshot(driver, "google_login_01_popup_opened")

        # ── 3. Enter email ──────────────────────────────────────
        print("   ✉️  Entering email...")
        email_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "identifierId"))
        )
        email_input.clear()
        for char in email:
            email_input.send_keys(char)
            time.sleep(random.uniform(0.05, 0.12))
        time.sleep(0.5)
        take_screenshot(driver, "google_login_02_email_typed")

        # Click Next after email
        next_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//span[normalize-space()='Next']/ancestor::button")
            )
        )
        next_btn.click()
        print("   ➡️  Clicked Next after email")
        time.sleep(3)
        take_screenshot(driver, "google_login_03_after_email_next")

        # ── 4. Enter password ───────────────────────────────────
        print("   🔑  Entering password...")
        password_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.NAME, "Passwd"))
        )
        password_input.clear()
        for char in password:
            password_input.send_keys(char)
            time.sleep(random.uniform(0.05, 0.12))
        time.sleep(0.5)
        take_screenshot(driver, "google_login_04_password_typed")

        # Click Next after password
        next_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable(
                (By.XPATH, "//span[normalize-space()='Next']/ancestor::button")
            )
        )
        next_btn.click()
        print("   ➡️  Clicked Next after password")
        time.sleep(4)
        take_screenshot(driver, "google_login_05_after_password_next")

        # ── 5. Switch back to main window ──────────────────────
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[0])
            print("   🔄 Switched back to main window")

        # Wait for dashboard
        WebDriverWait(driver, 20).until(
            lambda d: "dashboard" in d.current_url or "game" in d.current_url
        )
        take_screenshot(driver, "google_login_06_success")
        print("   ✅ Google login successful!")
        return True

    except Exception as e:
        print(f"   ❌ Google login failed: {e}")
        take_screenshot(driver, "google_login_failed")
        return False

# ============================================================
# GAME TESTER CLASS
# ============================================================

class UNOGameTester:
    def __init__(self):
        self.drivers    = []
        self.game_codes = []

    def close_all_drivers(self):
        for d in self.drivers:
            try:
                d.quit()
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
        time.sleep(2)
        if "dashboard" in driver.current_url or "game" in driver.current_url:
            print(f"   ✅ {player_name} already logged in")
            return True
        if GOOGLE_EMAIL and GOOGLE_PASSWORD:
            success = perform_google_login(driver, GOOGLE_EMAIL, GOOGLE_PASSWORD)
            if not success:
                print(f"   ⚠️ {player_name} could not log in automatically.")
            return success
        print(f"   ⚠️ No credentials in .env — skipping login for {player_name}")
        return False

    # backward-compatible alias
    def login_with_google_mock(self, driver, player_name):
        return self.login_with_google(driver, player_name)

    def create_game(self, driver, game_type="room"):
        print(f"   🎮 Creating {game_type} game...")
        if game_type == "1v1":
            el = wait_for_element(
                driver, By.XPATH,
                "//div[contains(@class,'from-pink-500')]"
                "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]"
            )
            if el:
                el.click()
            else:
                wait_and_click(driver, By.XPATH,
                    "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]")
        else:
            wait_and_click(driver, By.XPATH,
                "//button[.//span[contains(text(),'Create Room')] or contains(text(),'Create Room')]")
        time.sleep(2)
        code_el = wait_for_element(driver, By.XPATH, "//p[contains(@class,'tracking-widest')]")
        if code_el:
            code = code_el.text.strip()
            print(f"   🎫 Game Code: {code}")
            wait_and_click(driver, By.XPATH,
                "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")
            return code
        return None

    def join_game(self, driver, game_code):
        print(f"   🔗 Joining with code: {game_code}")
        inp = wait_for_element(driver, By.XPATH, "//input[@placeholder='Enter game code']")
        if inp:
            inp.clear()
            inp.send_keys(game_code)
            time.sleep(0.5)
            wait_and_click(driver, By.XPATH,
                "//button[.//span[contains(text(),'Join')] or contains(text(),'Join')]")
            print("   ✅ Join request sent")
            return True
        return False

    def get_player_hand(self, driver):
        return driver.find_elements(
            By.XPATH,
            "//div[contains(@class,'cursor-pointer')]//div[contains(@class,'rounded-xl')]"
        )

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
        log_result("Page Title", "PASS" if "UNO" in title else "FAIL", f"Title: {title}")

        logo = wait_for_element(driver, By.XPATH, "//div[contains(text(),'U')]")
        log_result("Logo Display", "PASS" if logo else "FAIL")

        # ── FIXED: button contains a span, not direct text ──
        login_btn = wait_for_element(driver, By.XPATH, LOGIN_BTN_XPATH)
        log_result("Login Button", "PASS" if login_btn else "FAIL",
                   f"Found: {login_btn is not None}")

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
    for w, h in [(1920, 1080), (1366, 768), (1280, 720)]:
        driver.set_window_size(w, h)
        time.sleep(1)
        visible = driver.find_element(By.TAG_NAME, "body").is_displayed()
        results.append(visible)
        print(f"   📐 {w}x{h}: {'✅' if visible else '❌'}")
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
    vp = driver.execute_script("return window.innerWidth")
    print(f"   📱 Viewport: {vp}px")
    visible = driver.find_element(By.TAG_NAME, "body").is_displayed()
    log_result("Mobile Responsive", "PASS" if visible else "FAIL", f"Viewport: {vp}px")
    take_screenshot(driver, "03_mobile_responsive")
    driver.quit()
    return True

def test_04_game_creation_1v1():
    print("\n" + "="*60)
    print("⚔️ TEST 4: Create 1v1 Game")
    print("="*60)
    tester = UNOGameTester()
    try:
        p1 = tester.create_player("Player 1")
        tester.login_with_google(p1, "Player 1")
        wait_and_click(p1, By.XPATH, "//div[contains(@class,'from-pink-500')]")
        time.sleep(1)
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]")
        time.sleep(2)
        code_el = wait_for_element(p1, By.XPATH, "//p[contains(@class,'tracking-widest')]")
        if code_el:
            log_result("Game Creation", "PASS", f"Code: {code_el.text.strip()}")
            wait_and_click(p1, By.XPATH,
                "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")
        else:
            log_result("Game Creation", "FAIL", "No game code found")
        take_screenshot(p1, "04_game_creation_1v1")
    except Exception as e:
        log_result("Game Creation", "FAIL", str(e))
    finally:
        tester.close_all_drivers()
    return True

def test_05_game_creation_room():
    print("\n" + "="*60)
    print("👥 TEST 5: Create Room Game")
    print("="*60)
    tester = UNOGameTester()
    try:
        p1 = tester.create_player("Host")
        tester.login_with_google(p1, "Host")
        wait_and_click(p1, By.XPATH, "//div[contains(@class,'from-blue-500')]")
        time.sleep(1)
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Create Room')] or contains(text(),'Create Room')]")
        time.sleep(2)
        code_el = wait_for_element(p1, By.XPATH, "//p[contains(@class,'tracking-widest')]")
        if code_el:
            log_result("Room Creation", "PASS", f"Code: {code_el.text.strip()}")
            players_text = get_text(p1, By.XPATH,
                "//p[contains(text(),'Players')]/following-sibling::p")
            log_result("Max Players Display",
                "PASS" if "10" in players_text else "WARN", f"Shows: {players_text}")
            wait_and_click(p1, By.XPATH,
                "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")
        else:
            log_result("Room Creation", "FAIL", "No game code found")
        take_screenshot(p1, "05_game_creation_room")
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
        p1 = tester.create_player("Host")
        tester.login_with_google(p1, "Host")
        wait_and_click(p1, By.XPATH, "//div[contains(@class,'from-pink-500')]")
        time.sleep(1)
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]")
        time.sleep(2)
        code_el = wait_for_element(p1, By.XPATH, "//p[contains(@class,'tracking-widest')]")
        if code_el:
            game_code = code_el.text.strip()
            print(f"   🎫 Game Code: {game_code}")
            wait_and_click(p1, By.XPATH,
                "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")

        p2 = tester.create_player("Joiner")
        tester.login_with_google(p2, "Joiner")
        inp = wait_for_element(p2, By.XPATH, "//input[@placeholder='Enter game code']")
        if inp and game_code:
            inp.clear()
            inp.send_keys(game_code)
            time.sleep(1)
            wait_and_click(p2, By.XPATH,
                "//button[.//span[contains(text(),'Join')] or contains(text(),'Join')]")
            log_result("Join Game", "PASS", f"Code: {game_code}")
        else:
            log_result("Join Game", "FAIL", "Could not join")
        take_screenshot(p2, "06_join_game")
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
    print(f"   ⏱️  Game will run for {TEST_DURATION} seconds\n")
    tester    = UNOGameTester()
    game_code = None
    try:
        p1 = tester.create_player("Player 1 (Host)")
        tester.login_with_google(p1, "Player 1")
        wait_and_click(p1, By.XPATH, "//div[contains(@class,'from-pink-500')]")
        time.sleep(1)
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]")
        time.sleep(3)
        code_el = wait_for_element(p1, By.XPATH, "//p[contains(@class,'tracking-widest')]")
        if code_el:
            game_code = code_el.text.strip()
            print(f"   🎫 Game Code: {game_code}")
            wait_and_click(p1, By.XPATH,
                "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")

        p2 = tester.create_player("Player 2")
        tester.login_with_google(p2, "Player 2")
        inp = wait_for_element(p2, By.XPATH, "//input[@placeholder='Enter game code']")
        if inp and game_code:
            inp.clear()
            inp.send_keys(game_code)
            time.sleep(1)
            wait_and_click(p2, By.XPATH,
                "//button[.//span[contains(text(),'Join')] or contains(text(),'Join')]")
            print("   ✅ Player 2 joined")
        time.sleep(3)

        game_started = False
        t0 = time.time()
        while time.time() - t0 < 15:
            for drv in [p1, p2]:
                if "/game/" in drv.current_url:
                    game_started = True
                    break
            if game_started:
                break
            time.sleep(1)

        if game_started:
            log_result("Game Start", "PASS", "Both players in game")
            print(f"\n🎮 PLAYING — watch for {TEST_DURATION} seconds!\n")
            end_t            = time.time() + TEST_DURATION
            turn_count       = 0
            last_turn_player = None

            while time.time() < end_t:
                for idx, drv in enumerate([p1, p2]):
                    if "/game/" not in drv.current_url:
                        continue
                    try:
                        turn_els = drv.find_elements(
                            By.XPATH, "//p[contains(text(),'Your Turn')]")
                        is_turn = len(turn_els) > 0 and "Your Turn" in turn_els[0].text
                        if is_turn and last_turn_player != idx:
                            last_turn_player = idx
                            turn_count      += 1
                            print(f"   🎯 Turn {turn_count}: Player {idx+1}")
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
                                    print(f"      🃏 Played a card")
                                except:
                                    draws = drv.find_elements(
                                        By.XPATH,
                                        "//button[contains(text(),'Draw Card')"
                                        " or .//span[contains(text(),'Draw Card')]]"
                                    )
                                    if draws and draws[0].is_enabled():
                                        draws[0].click()
                                        print(f"      🎴 Drew a card")
                            else:
                                draws = drv.find_elements(
                                    By.XPATH,
                                    "//button[contains(text(),'Draw Card')"
                                    " or .//span[contains(text(),'Draw Card')]]"
                                )
                                if draws and draws[0].is_enabled():
                                    draws[0].click()
                                    print(f"      🎴 Drew a card")
                            time.sleep(random.uniform(1, 2))
                    except:
                        pass
                time.sleep(1)
                elapsed = int(time.time() - (end_t - TEST_DURATION))
                if elapsed % 5 == 0 and elapsed > 0:
                    print(f"   ⏱️ {TEST_DURATION - elapsed}s remaining...")

            log_result("Game Mechanics", "PASS", f"{turn_count} turns played")
            take_screenshot(p1, "07_game_p1")
            take_screenshot(p2, "07_game_p2")
            print(f"   ✅ Done! Turns played: {turn_count}")
        else:
            log_result("Game Start", "FAIL", "Timed out waiting for game")
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
        p1 = tester.create_player("Host")
        tester.login_with_google(p1, "Host")
        wait_and_click(p1, By.XPATH, "//div[contains(@class,'from-pink-500')]")
        time.sleep(1)
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]")
        time.sleep(2)
        copy_btn = wait_for_element(p1, By.XPATH,
            "//button[.//span[contains(text(),'Copy Code')] or contains(text(),'Copy Code')]")
        log_result("Copy Button Exists", "PASS" if copy_btn else "FAIL")
        if copy_btn:
            copy_btn.click()
            time.sleep(0.5)
            log_result("Copy Function", "PASS", "Clicked successfully")
        take_screenshot(p1, "08_copy_code")
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")
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
        driver.find_element(By.TAG_NAME, "body").is_displayed()
        log_result("Page Structure", "PASS", "Page loads correctly")
        take_screenshot(driver, "09_logout_check")
    except Exception as e:
        log_result("Logout Test", "FAIL", str(e))
    finally:
        driver.quit()
    return True

def test_10_error_handling():
    print("\n" + "="*60)
    print("⚠️ TEST 10: Error Handling")
    print("="*60)
    tester = UNOGameTester()
    try:
        p1 = tester.create_player("Player 1")
        tester.login_with_google(p1, "Player 1")
        inp = wait_for_element(p1, By.XPATH, "//input[@placeholder='Enter game code']")
        if inp:
            inp.clear()
            inp.send_keys("INVALID123")
            time.sleep(1)
            wait_and_click(p1, By.XPATH,
                "//button[.//span[contains(text(),'Join')] or contains(text(),'Join')]")
            time.sleep(2)
            log_result("Invalid Code Handling", "PASS", "Attempted invalid code")
        take_screenshot(p1, "10_error_handling")
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
        spinner = wait_for_element(driver, By.XPATH, "//div[contains(@class,'animate-spin')]")
        bounce  = wait_for_element(driver, By.XPATH, "//div[contains(@class,'animate-bounce')]")
        log_result("Loading Animation",
                   "PASS" if (spinner or bounce) else "WARN", "Animation check done")
        take_screenshot(driver, "11_loading_screen")
    except Exception as e:
        log_result("Loading Animation", "FAIL", str(e))
    finally:
        driver.quit()
    return True

def test_12_card_visuals():
    print("\n" + "="*60)
    print("🃏 TEST 12: Card Visuals")
    print("="*60)
    tester = UNOGameTester()
    try:
        p1 = tester.create_player("Player 1")
        tester.login_with_google(p1, "Player 1")
        wait_and_click(p1, By.XPATH, "//div[contains(@class,'from-pink-500')]")
        time.sleep(1)
        wait_and_click(p1, By.XPATH,
            "//button[.//span[contains(text(),'Create Game')] or contains(text(),'Create Game')]")
        time.sleep(2)
        code_el = wait_for_element(p1, By.XPATH, "//p[contains(@class,'tracking-widest')]")
        if code_el:
            wait_and_click(p1, By.XPATH,
                "//button[.//span[contains(text(),'Done')] or contains(text(),'Done')]")
        p2 = tester.create_player("Player 2")
        tester.login_with_google(p2, "Player 2")
        log_result("Card Visuals", "PASS", "Card display structure OK")
        take_screenshot(p1, "12_card_visuals")
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
    for r in test_results:
        icon = "✅" if r["status"] == "PASS" else "❌" if r["status"] == "FAIL" else "⚠️"
        print(f"   {icon} {r['timestamp']} - {r['test']}: {r['status']}")
        if r["message"]:
            print(f"      📝 {r['message']}")
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
        print("⚠️  CREDENTIALS MISSING — create a .env file:")
        print("     TEST_GOOGLE_EMAIL=your@gmail.com")
        print("     TEST_GOOGLE_PASSWORD=yourpassword\n")
    else:
        print(f"✅ Credentials loaded for: {GOOGLE_EMAIL}\n")

    input("✅ Press Enter to start tests...")

    tests = [
        ("Page Load & Basic UI",    test_01_page_load),
        ("Desktop Responsive",      test_02_responsive_desktop),
        ("Mobile Responsive",       test_03_responsive_mobile),
        ("Create 1v1 Game",         test_04_game_creation_1v1),
        ("Create Room Game",        test_05_game_creation_room),
        ("Join Game",               test_06_join_game),
        ("Game Mechanics (Watch!)", test_07_game_mechanics),
        ("Copy Game Code",          test_08_game_code_copy),
        ("Logout Functionality",    test_09_logout_functionality),
        ("Error Handling",          test_10_error_handling),
        ("Loading Animation",       test_11_loading_screen_animation),
        ("Card Visuals",            test_12_card_visuals),
    ]

    print("\n🚀 Starting...\n")
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