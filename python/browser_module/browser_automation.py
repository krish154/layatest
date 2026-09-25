"""
Browser Automation Module
==========================
Playwright-based browser automation with element grounding for Laya decisions.

Features:
- DOM/accessibility tree extraction
- Element grouping and grounding
- Laya-friendly element descriptions
- Screenshot + vision fallback
- State management

Usage:
    from browser_module import BrowserAutomation
    browser = BrowserAutomation()
    await browser.start()
    state = await browser.get_state()
    await browser.click_element(element_id)
"""

import asyncio
import json
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    print("Playwright not installed. Install with: pip install playwright && playwright install chromium")


@dataclass
class ElementInfo:
    """Simplified element representation for Laya decisions."""
    id: str
    tag: str
    text: str
    role: str  # button, link, input, etc.
    selector: str
    visible: bool
    clickable: bool
    bbox: Optional[Dict[str, int]] = None  # x, y, width, height
    
    def to_laya_format(self) -> Dict:
        """Convert to Laya-friendly format (minimal info)."""
        return {
            "id": self.id,
            "type": self.role,
            "text": self.text[:50],  # Truncate for Laya
            "action": "click" if self.clickable else "none"
        }


@dataclass
class BrowserState:
    """Current browser state for Laya/Qwen decisions."""
    url: str
    title: str
    elements: List[ElementInfo]
    buttons: List[ElementInfo]
    inputs: List[ElementInfo]
    links: List[ElementInfo]
    aria_tree: Dict[str, Any]
    screenshot_path: Optional[str] = None
    
    def to_laya_context(self) -> Dict:
        """Compressed state for Laya (System-1)."""
        return {
            "url": self.url,
            "title": self.title,
            "interactive_elements": [e.to_laya_format() for e in self.elements[:20]],  # Limit for speed
            "buttons_count": len(self.buttons),
            "inputs_count": len(self.inputs),
        }
    
    def to_qwen_context(self) -> Dict:
        """Full state for Qwen (System-2)."""
        return {
            "url": self.url,
            "title": self.title,
            "elements": [vars(e) for e in self.elements],
            "buttons": [vars(e) for e in self.buttons],
            "inputs": [vars(e) for e in self.inputs],
            "links": [vars(e) for e in self.links],
            "has_screenshot": self.screenshot_path is not None,
        }


class BrowserAutomation:
    """Playwright-based browser with Laya-optimized element grounding."""
    
    def __init__(self, headless: bool = True):
        if not HAS_PLAYWRIGHT:
            raise RuntimeError("Playwright not installed")
        
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._element_counter = 0
    
    async def start(self):
        """Start browser instance."""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=self.headless)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()
    
    async def stop(self):
        """Stop browser instance."""
        if self.browser:
            await self.browser.close()
    
    async def navigate(self, url: str):
        """Navigate to URL."""
        if not self.page:
            raise RuntimeError("Browser not started")
        await self.page.goto(url, wait_until="domcontentloaded")
    
    async def get_state(self, include_screenshot: bool = False) -> BrowserState:
        """Get current browser state with element grounding."""
        if not self.page:
            raise RuntimeError("Browser not started")
        
        # Extract elements from DOM
        elements = await self._extract_elements()
        
        # Categorize elements
        buttons = [e for e in elements if e.role in ["button", "submit", "link"]]
        inputs = [e for e in elements if e.role in ["input", "textbox", "textarea"]]
        links = [e for e in elements if e.role == "link"]
        
        # Get accessibility tree (simplified)
        aria_tree = await self._get_aria_tree()
        
        # Optional screenshot
        screenshot_path = None
        if include_screenshot:
            screenshot_path = f"/tmp/browser_state_{id(self)}.png"
            await self.page.screenshot(path=screenshot_path)
        
        return BrowserState(
            url=self.page.url,
            title=await self.page.title(),
            elements=elements,
            buttons=buttons,
            inputs=inputs,
            links=links,
            aria_tree=aria_tree,
            screenshot_path=screenshot_path,
        )
    
    async def click_element(self, element_id: str):
        """Click element by ID."""
        if not self.page:
            raise RuntimeError("Browser not started")
        
        selector = f"[data-laya-id='{element_id}']"
        element = await self.page.query_selector(selector)
        if element:
            await element.click()
            await asyncio.sleep(0.5)  # Wait for action
        else:
            raise ValueError(f"Element not found: {element_id}")
    
    async def type_text(self, element_id: str, text: str):
        """Type text into element."""
        if not self.page:
            raise RuntimeError("Browser not started")
        
        selector = f"[data-laya-id='{element_id}']"
        element = await self.page.query_selector(selector)
        if element:
            await element.fill(text)
        else:
            raise ValueError(f"Element not found: {element_id}")
    
    async def search_google(self, query: str) -> List[Dict]:
        """Search Google and return results."""
        await self.navigate(f"https://www.google.com/search?q={query}")
        await asyncio.sleep(1)
        
        # Extract search results
        results = await self.page.query_selector_all(".g")
        search_results = []
        
        for result in results[:10]:
            try:
                title_elem = await result.query_selector("h3")
                link_elem = await result.query_selector("a")
                
                if title_elem and link_elem:
                    title = await title_elem.text_content()
                    url = await link_elem.get_attribute("href")
                    
                    search_results.append({
                        "title": title,
                        "url": url,
                    })
            except Exception:
                continue
        
        return search_results
    
    async def _extract_elements(self) -> List[ElementInfo]:
        """Extract interactive elements from page."""
        if not self.page:
            return []
        
        # JavaScript to extract elements
        script = """
        () => {
            const elements = [];
            const interactive = document.querySelectorAll('button, a, input, textarea, [role="button"], [onclick]');
            
            interactive.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                
                if (isVisible) {
                    // Assign unique ID
                    el.setAttribute('data-laya-id', `elem_${index}`);
                    
                    elements.push({
                        id: `elem_${index}`,
                        tag: el.tagName.toLowerCase(),
                        text: (el.textContent || el.value || '').trim().substring(0, 100),
                        role: el.getAttribute('role') || el.tagName.toLowerCase(),
                        selector: el.tagName.toLowerCase(),
                        visible: true,
                        clickable: true,
                        bbox: {
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        }
                    });
                }
            });
            
            return elements;
        }
        """
        
        try:
            elements_data = await self.page.evaluate(script)
            return [ElementInfo(**e) for e in elements_data]
        except Exception as e:
            print(f"Error extracting elements: {e}")
            return []
    
    async def _get_aria_tree(self) -> Dict:
        """Get simplified accessibility tree."""
        if not self.page:
            return {}
        
        try:
            # Get accessibility snapshot
            snapshot = await self.page.accessibility.snapshot()
            return snapshot or {}
        except Exception:
            return {}


# ============================================================
# Browser Tools for MCP
# ============================================================
browser_instance: Optional[BrowserAutomation] = None


async def browser_open(url: str = "https://www.google.com", **kwargs) -> Dict:
    """Open URL in browser."""
    global browser_instance
    
    if not browser_instance:
        browser_instance = BrowserAutomation(headless=False)
        await browser_instance.start()
    
    await browser_instance.navigate(url)
    return {"success": True, "url": url}


async def browser_search(query: str = "", **kwargs) -> Dict:
    """Search Google."""
    global browser_instance
    
    if not browser_instance:
        browser_instance = BrowserAutomation(headless=False)
        await browser_instance.start()
    
    results = await browser_instance.search_google(query)
    return {"success": True, "query": query, "results": results, "count": len(results)}


async def browser_get_state(**kwargs) -> Dict:
    """Get current browser state for Laya decisions."""
    global browser_instance
    
    if not browser_instance:
        return {"error": "Browser not started"}
    
    state = await browser_instance.get_state(include_screenshot=False)
    return state.to_laya_context()


async def browser_click(element_id: str = "", **kwargs) -> Dict:
    """Click element by ID."""
    global browser_instance
    
    if not browser_instance:
        return {"error": "Browser not started"}
    
    try:
        await browser_instance.click_element(element_id)
        return {"success": True, "element_id": element_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def browser_type(element_id: str = "", text: str = "", **kwargs) -> Dict:
    """Type text into element."""
    global browser_instance
    
    if not browser_instance:
        return {"error": "Browser not started"}
    
    try:
        await browser_instance.type_text(element_id, text)
        return {"success": True, "element_id": element_id, "text": text}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def browser_close(**kwargs) -> Dict:
    """Close browser."""
    global browser_instance
    
    if browser_instance:
        await browser_instance.stop()
        browser_instance = None
    
    return {"success": True}


# Register browser tools
def register_browser_tools(registry):
    """Register all browser tools with MCP registry."""
    from server import ToolDefinition
    
    registry.register(
        ToolDefinition("browser.open", "browser", "Open URL in browser", "low",
                       input_schema={"url": "string"}),
        browser_open
    )
    registry.register(
        ToolDefinition("browser.search", "browser", "Search Google", "low",
                       input_schema={"query": "string"}),
        browser_search
    )
    registry.register(
        ToolDefinition("browser.get_state", "browser", "Get browser state for decisions", "low"),
        browser_get_state
    )
    registry.register(
        ToolDefinition("browser.click", "browser", "Click element", "low",
                       input_schema={"element_id": "string"}),
        browser_click
    )
    registry.register(
        ToolDefinition("browser.type", "browser", "Type into element", "low",
                       input_schema={"element_id": "string", "text": "string"}),
        browser_type
    )
    registry.register(
        ToolDefinition("browser.close", "browser", "Close browser", "low"),
        browser_close
    )
