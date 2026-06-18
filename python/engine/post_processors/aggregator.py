class ResultAggregator:
    def __init__(self):
        self.results = []

    def add_result(self, result):
        self.results.append(result)

    def get_best(self):
        if not self.results:
            return None
        return max(self.results, key=lambda r: getattr(r, 'score', 0) if hasattr(r, 'score') else 0)
