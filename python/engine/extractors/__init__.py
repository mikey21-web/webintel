from .html_extractors import SelectolaxExtractor, ParselExtractor, TrafilaturaExtractor
from .article_extractors import ReadabilityExtractor, NewspaperExtractor
from .metadata_extractors import ExtructExtractor
from .format_converters import Html2TextConverter, MarkdownifyConverter
from .specialized import PriceParserExtractor
from ..base import BaseExtractor

ALL_EXTRACTORS: list[type[BaseExtractor]] = [
    SelectolaxExtractor,
    ParselExtractor,
    TrafilaturaExtractor,
    ReadabilityExtractor,
    NewspaperExtractor,
    ExtructExtractor,
    Html2TextConverter,
    MarkdownifyConverter,
    PriceParserExtractor,
]

__all__ = ["ALL_EXTRACTORS", *[e.__name__ for e in ALL_EXTRACTORS]]
