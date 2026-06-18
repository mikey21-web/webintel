Gem::Specification.new do |s|
  s.name        = "webintel"
  s.version     = "1.0.0"
  s.summary     = "WebIntel API client — domain intelligence, web scraping, brand data"
  s.description = "Ruby client for the WebIntel API"
  s.authors     = ["WebIntel"]
  s.files       = Dir["lib/**/*.rb"]
  s.require_paths = ["lib"]
  s.required_ruby_version = ">= 2.7"
  s.add_dependency "httparty", "~> 0.21"
  s.license     = "MIT"
end
