"""Managed browser session pool — provides persistent CDP WebSocket URLs for agents."""

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BrowserSession:
    session_id: str
    cdp_ws_url: str
    page_url: str = "about:blank"
    created_at: float = field(default_factory=time.time)
    last_used_at: float = field(default_factory=time.time)
    user_id: Optional[str] = None

    @property
    def alive(self) -> bool:
        return True  # Managed externally

    @property
    def idle_seconds(self) -> float:
        return time.time() - self.last_used_at


class BrowserSessionManager:
    """Singleton manager for browser sessions."""

    _instance: Optional["BrowserSessionManager"] = None

    def __init__(self):
        self._sessions: dict[str, BrowserSession] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._max_sessions = 20
        self._idle_timeout = 600  # 10 minutes

    @classmethod
    def get_instance(cls) -> "BrowserSessionManager":
        if cls._instance is None:
            cls._instance = BrowserSessionManager()
        return cls._instance

    async def create_session(
        self,
        headless: bool = True,
        user_id: Optional[str] = None,
    ) -> BrowserSession:
        if len(self._sessions) >= self._max_sessions:
            oldest = min(
                self._sessions.values(),
                key=lambda s: s.last_used_at,
            )
            await self.destroy_session(oldest.session_id)

        session_id = str(uuid.uuid4())[:8]

        try:
            from playwright.async_api import async_playwright

            pw = await async_playwright().start()
            browser = await pw.chromium.launch(
                headless=headless,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )

            cdp_session = await browser.new_context()
            page = await cdp_session.new_page()
            cdp_url = await page.evaluate(
                "() => window.location.origin + '/json/version'"
            )

            # Get actual CDP WebSocket URL from browser
            cdp_ws_url = ""
            try:
                import asyncio
                import json
                import urllib.request

                # Fetch browser devtools endpoint
                async def _get_ws():
                    try:
                        browser_version = await page.evaluate("""
                            async () => {
                                const resp = await fetch('/json/version');
                                const data = await resp.json();
                                return data.webSocketDebuggerUrl || '';
                            }
                        """)
                        return browser_version
                    except Exception:
                        return ""

                cdp_ws_url = await _get_ws()
            except Exception:
                pass

            if not cdp_ws_url:
                # Fallback: get from browser
                browser_ws = getattr(browser, "_connection", None)
                if browser_ws and hasattr(browser_ws, "_ws_endpoint"):
                    cdp_ws_url = browser_ws._ws_endpoint

            session = BrowserSession(
                session_id=session_id,
                cdp_ws_url=cdp_ws_url or f"ws://localhost:9222/devtools/browser/{session_id}",
                user_id=user_id,
            )

            # Store browser reference for later cleanup
            session._pw = pw
            session._browser = browser
            session._page = page

            self._sessions[session_id] = session
            return session

        except ImportError:
            raise RuntimeError(
                "playwright not installed. Install with: pip install playwright"
            )

    async def get_session(self, session_id: str) -> Optional[BrowserSession]:
        session = self._sessions.get(session_id)
        if session:
            session.last_used_at = time.time()
        return session

    async def navigate_session(self, session_id: str, url: str) -> BrowserSession:
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        if hasattr(session, "_page"):
            await session._page.goto(url, wait_until="networkidle")
            session.page_url = url
            session.last_used_at = time.time()

        return session

    async def destroy_session(self, session_id: str) -> bool:
        session = self._sessions.pop(session_id, None)
        if not session:
            return False

        try:
            if hasattr(session, "_browser"):
                await session._browser.close()
            if hasattr(session, "_pw"):
                await session._pw.stop()
        except Exception:
            pass

        return True

    async def list_sessions(self, user_id: Optional[str] = None) -> list[BrowserSession]:
        sessions = list(self._sessions.values())
        if user_id:
            sessions = [s for s in sessions if s.user_id == user_id]
        return sessions

    async def cleanup_idle(self) -> int:
        now = time.time()
        to_remove = [
            sid
            for sid, s in self._sessions.items()
            if now - s.last_used_at > self._idle_timeout
        ]
        for sid in to_remove:
            await self.destroy_session(sid)
        return len(to_remove)

    @property
    def session_count(self) -> int:
        return len(self._sessions)


def get_session_manager() -> BrowserSessionManager:
    return BrowserSessionManager.get_instance()
