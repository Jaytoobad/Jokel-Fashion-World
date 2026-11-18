from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({'width': 375, 'height': 667})
    
    # Go to admin login
    page.goto('https://jokel-fashion-world-sigma.vercel.app/admin', wait_until='networkidle')
    page.wait_for_timeout(1000)
    page.screenshot(path='admin_login_mobile.png', full_page=True)
    print('Login page loaded')
    
    # Fill login form
    page.fill('input[type="email"]', 'jasonasare211@gmail.com')
    page.fill('input[type="password"]', 'ChangeMe123!')
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)
    page.screenshot(path='admin_dashboard_mobile.png', full_page=True)
    print('Dashboard loaded')
    
    # Check all tabs - use .adm-link selector
    tabs = ['dashboard', 'applications', 'enquiries', 'content', 'audit']
    for tab in tabs:
        page.click(f'.adm-link[data-tab="{tab}"]')
        page.wait_for_timeout(1000)
        page.screenshot(path=f'admin_{tab}_mobile.png', full_page=True)
        print(f'Tab {tab}: OK')
    
    # Test content sub-tabs - use data-table
    page.click('.adm-link[data-tab="content"]')
    page.wait_for_timeout(1000)
    content_tabs = ['programmes', 'gallery_items', 'achievements']
    for ct in content_tabs:
        page.click(f'.content-tab[data-table="{ct}"]')
        page.wait_for_timeout(1000)
        page.screenshot(path=f'admin_content_{ct}_mobile.png', full_page=True)
        print(f'Content tab {ct}: OK')
    
    page.close()
    browser.close()
    print('All admin tests passed!')