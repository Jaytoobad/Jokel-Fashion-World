from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({'width': 375, 'height': 667})
    page.goto('https://jokel-fashion-world-sigma.vercel.app', wait_until='networkidle')
    page.wait_for_timeout(2000)
    
    # Click burger to open mobile menu
    burger = page.locator('.burger')
    if burger.is_visible():
        burger.click()
        page.wait_for_timeout(1000)
        page.screenshot(path='mobile_menu_open.png', full_page=True)
        print('Menu opened, screenshot saved')
        
        # Check if nav overlaps header
        nav = page.locator('nav.open')
        header = page.locator('header')
        print('Nav visible:', nav.is_visible())
        print('Nav z-index:', nav.evaluate('el => getComputedStyle(el).zIndex'))
        print('Header z-index:', header.evaluate('el => getComputedStyle(el).zIndex'))
    else:
        print('Burger not visible on this page')
    
    page.close()
    browser.close()