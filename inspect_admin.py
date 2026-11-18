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
    
    # Inspect the nav
    html = page.content()
    import re
    
    # Find nav elements
    navs = re.findall(r'<[^>]*admin-nav[^>]*>.*?</[^>]*>', html, re.DOTALL)
    for n in navs[:5]:
        print('NAV:', n[:500])
    
    # Look for all buttons
    buttons = re.findall(r'<button[^>]*>.*?</button>', html, re.DOTALL)
    for b in buttons:
        print('BTN:', b[:200].encode('ascii', 'ignore').decode())
    
    # Look for tabs
    tabs = re.findall(r'data-tab="[^"]*"', html)
    print('DATA-TABS:', tabs)
    
    # Look for content-tabs
    ctabs = re.findall(r'content-tab[^>]*>.*?</button>', html, re.DOTALL)
    for c in ctabs:
        print('CTAB:', c[:200].encode('ascii', 'ignore').decode())
    
    page.close()
    browser.close()