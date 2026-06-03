from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class ScrapeResult:
    url: str
    html: str = ""
    markdown: str = ""
    text: str = ""
    title: str = ""
    description: str = ""
    og_image: str = ""
    site_name: str = ""
    author: str = ""
    published_date: Optional[str] = None
    json_ld: list[dict] = field(default_factory=list)
    open_graph: dict = field(default_factory=dict)
    twitter_card: dict = field(default_factory=dict)
    microdata: list[dict] = field(default_factory=list)
    links_internal: list[str] = field(default_factory=list)
    links_external: list[str] = field(default_factory=list)
    prices: list[dict] = field(default_factory=list)
    screenshot_base64: Optional[str] = None
    source: str = ""
    quality_score: float = 0.0
    extracted_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: dict = field(default_factory=dict)


class BaseBackend(ABC):
    name: str = ""
    priority: int = 100
    requires_docker: bool = False
    requires_node: bool = False
    requires_binary: bool = False

    @abstractmethod
    async def check_available(self) -> bool:
        ...

    @abstractmethod
    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        ...


class BaseExtractor(ABC):
    name: str = ""

    @abstractmethod
    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        ...


class BaseProcessor(ABC):
    name: str = ""

    @abstractmethod
    def process(self, results: list[ScrapeResult]) -> list[ScrapeResult]:
        ...
