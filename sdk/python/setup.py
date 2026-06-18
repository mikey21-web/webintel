from setuptools import setup, find_packages

with open("README.md", "r") as fh:
    long_description = fh.read()

setup(
    name="webintel",
    version="0.1.0",
    description="WebIntel API client — domain intelligence, web scraping, brand data",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="WebIntel",
    packages=find_packages(),
    install_requires=["httpx>=0.27.0"],
    python_requires=">=3.8",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
    ],
)
