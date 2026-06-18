from .quality_scorer import QualityScorer, ResultAggregator

ALL_PROCESSORS = [ResultAggregator, QualityScorer]

__all__ = ["ALL_PROCESSORS", "ResultAggregator", "QualityScorer"]
