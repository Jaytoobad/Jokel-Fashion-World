from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # Test all site pages on mobile
    pages = [
        ('/', 'home'),
        ('/about', 'about'),
        ('/academy', 'academy'),
        ('/gallery', 'gallery'),
        ('/designs', 'designs'),
        ('/contact', 'contact'),
    ]
    
    for path, name in pages:
        page = browser.new_page()
        page.set_viewport_size({'width': 375, 'height': 667})
        page.goto(f'https://jokel-fashion-world-sigma.vercel.app{path}', wait_until='networkidle')
        page.wait_for_timeout(2000)
        
        # Test burger menu open/close
        burger = page.locator('.burger')
        menu_test = 'N/A'
        if burger.is_visible():
            burger.click()
            page.wait_for_timeout(1000)
            nav = page.locator('nav.open')
            menu_test = 'open OK' if nav.is_visible() else 'open FAIL'
            burger.click()  # close
            page.wait_for_timeout(1000)
        
        page.screenshot(path=f'{name}_mobile.png', full_page=True)
        errors = []
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        print(f'{name}: OK | menu: {menu_test} | errors: {len(errors)}')
        page.close()
    
    browser.close()
    print('All mobile page tests complete!')