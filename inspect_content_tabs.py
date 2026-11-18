from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({'width': 375, 'height': 667})
    page.goto('https://jokel-fashion-world-sigma.vercel.app/admin', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.fill('input[type="email"]', 'jasonasare211@gmail.com')
    page.fill('input[type="password"]', 'ChangeMe123!')
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)
    page.click('.adm-link[data-tab="content"]')
    page.wait_for_timeout(1000)
    
    # Inspect content tabs
    html = page.content()
    import re
    
    # Look for content tabs
    ctabs = re.findall(r'<button[^>]*content-tab[^>]*>.*?</button>', html, re.DOTALL)
    for c in ctabs:
        print('CTAB:', c[:300].encode('ascii', 'ignore').decode())
    
    page.close()
    browser.close()