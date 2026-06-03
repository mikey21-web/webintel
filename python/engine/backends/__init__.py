from .http_backends import HTTPXBackend, AiohttpBackend, CurlCFFIBackend, RequestsHTMLBackend
from .browser_backends import PlaywrightBackend, UndetectedChromeBackend, NodriverBackend, SeleniumBackend, CamoufoxBackend
from .ai_backends import Crawl4AIBackend, JinaReaderBackend, FirecrawlBackend, ScrapeGraphAIBackend
from .framework_backends import ScrapyBackend, CrawleeBackend, ScraplingBackend, BotasaurusBackend, MechanicalSoupBackend
from .docker_backends import SplashBackend, BrowserlessBackend
from .node_backends import PuppeteerStealthBackend, CrawleeNodeBackend, GotScrapingBackend
from .curl_impersonate import CurlImpersonateBackend
from ..base import BaseBackend

ALL_BACKENDS: list[type[BaseBackend]] = [
    HTTPXBackend,
    AiohttpBackend,
    CurlCFFIBackend,
    CurlImpersonateBackend,
    GotScrapingBackend,
    JinaReaderBackend,
    MechanicalSoupBackend,
    RequestsHTMLBackend,
    ScraplingBackend,
    BotasaurusBackend,
    CrawleeBackend,
    NodriverBackend,
    UndetectedChromeBackend,
    CamoufoxBackend,
    PlaywrightBackend,
    Crawl4AIBackend,
    SeleniumBackend,
    FirecrawlBackend,
    ScrapeGraphAIBackend,
    SplashBackend,
    BrowserlessBackend,
    PuppeteerStealthBackend,
    CrawleeNodeBackend,
    ScrapyBackend,
]

__all__ = ["ALL_BACKENDS", *[b.__name__ for b in ALL_BACKENDS]]
