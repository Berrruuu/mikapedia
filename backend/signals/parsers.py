from rest_framework.parsers import BaseParser
from rest_framework.exceptions import ParseError
import json


class PlainTextJSONParser(BaseParser):
    """Parser for `text/plain` request bodies that contain JSON.

    This allows TradingView alerts which send JSON with Content-Type
    `text/plain` to be accepted by DRF without returning 415.
    """
    media_type = 'text/plain'

    def parse(self, stream, media_type=None, parser_context=None):
        data = stream.read()
        if not data:
            return {}
        try:
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            return json.loads(data)
        except Exception as exc:
            raise ParseError(f'PlainTextJSONParser could not parse JSON: {exc}')
