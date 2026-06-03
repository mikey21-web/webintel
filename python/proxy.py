import random
from typing import Optional

PROXY_POOL: list[str] = []

async def init_proxy_pool(api_key: str = "") -> None:
    global PROXY_POOL
    if api_key:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"https://proxy.provider.com/api/list?key={api_key}")
                if resp.status_code == 200:
                    PROXY_POOL = [f"http://{p['ip']}:{p['port']}" for p in resp.json()]
        except Exception:
            PROXY_POOL = []

async def get_proxy() -> Optional[dict]:
    if not PROXY_POOL:
        return None
    proxy = random.choice(PROXY_POOL)
    return {"http": proxy, "https": proxy}

def has_proxies() -> bool:
    return len(PROXY_POOL) > 0
