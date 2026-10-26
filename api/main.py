"""
Vercel Serverless Function entrypoint shim.
"""

from .index import app, handler

__all__ = ["app", "handler"]
