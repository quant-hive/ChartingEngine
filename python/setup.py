from setuptools import setup, find_packages

setup(
    name="flash-plot",
    version="0.2.0",
    description="Matplotlib-like charting engine with premium dark aesthetics — for Jupyter, Colab, and the web.",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[],
    extras_require={
        "notebook": ["ipython"],
        "numpy": ["numpy"],
    },
)
