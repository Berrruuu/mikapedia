from rest_framework.response import Response


def success_response(data=None, status=200, meta=None):
    payload = {'success': True, 'data': data}
    if meta is not None:
        payload['meta'] = meta
    return Response(payload, status=status)


def error_response(message, status=400, code='request_failed', details=None):
    payload = {
        'success': False,
        'error': {'code': code, 'message': message},
    }
    if details is not None:
        payload['error']['details'] = details
    return Response(payload, status=status)
