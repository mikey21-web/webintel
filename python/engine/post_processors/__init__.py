from .aggregator import ResultAggregator
from .quality_scorer import QualityScorer

ALL_PROCESSORS = [ResultAggregator, QualityScorer]

__all__ = ["ALL_PROCESSORS", "ResultAggregator", "QualityScorer"]
