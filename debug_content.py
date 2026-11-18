from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({'width': 375, 'height': 667})
    
    # Go to admin login
    page.goto('https://jokel-fashion-world-sigma.vercel.app/admin', wait_until='networkidle')
    page.wait_for_timeout(1000)
    page.fill('input[type="email"]', 'jasonasare211@gmail.com')
    page.fill('input[type="password"]', 'ChangeMe123!')
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)
    
    # Go to content tab
    page.click('.adm-link[data-tab="content"]')
    page.wait_for_timeout(1000)
    page.screenshot(path='admin_content_mobile.png', full_page=True)
    
    # Check if content tabs exist
    ctabs = page.locator('.content-tab').all()
    print(f'Content tabs found: {len(ctabs)}')
    for i, ct in enumerate(ctabs):
        print(f'  Tab {i}: visible={ct.is_visible()}, text={ct.inner_text()}')
    
    # Check content panels
    panels = page.locator('.content-panel').all()
    print(f'Content panels found: {len(panels)}')
    
    page.close()
    browser.close()