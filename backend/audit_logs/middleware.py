from .utils import set_current_request


class AuditRequestMiddleware:
    """Middleware that saves the current request in thread-local storage
    so background helpers and model signals can access request metadata.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_request(request)
        response = self.get_response(request)
        return response
