from django.http import Http404
from rest_framework import exceptions, pagination, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend


class StandardizedPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class StandardJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        if renderer_context is None:
            renderer_context = {}

        response = renderer_context.get('response')
        if response is None:
            return super().render(data, accepted_media_type, renderer_context)

        if isinstance(data, dict) and 'success' in data:
            return super().render(data, accepted_media_type, renderer_context)

        if response.status_code >= 400:
            details = data
            message = 'Request failed.'
            code = 'request_failed'

            if isinstance(data, dict):
                if 'detail' in data:
                    message = data['detail']
                elif 'message' in data:
                    message = data['message']
                elif 'errors' in data:
                    details = data['errors']
                    message = 'Validation failed.'
                    code = 'validation_error'
                else:
                    message = 'Validation failed.' if response.status_code == 400 else message
            payload = {
                'success': False,
                'error': {
                    'code': code,
                    'message': message,
                },
            }
            if details is not None:
                payload['error']['details'] = details
            return super().render(payload, accepted_media_type, renderer_context)

        if isinstance(data, dict) and 'results' in data and 'count' in data:
            meta = {
                'count': data.get('count', 0),
                'next': data.get('next'),
                'previous': data.get('previous'),
            }
            payload = {
                'success': True,
                'data': data.get('results', []),
                'meta': meta,
            }
            return super().render(payload, accepted_media_type, renderer_context)

        payload = {
            'success': True,
            'data': data,
        }
        return super().render(payload, accepted_media_type, renderer_context)


def custom_exception_handler(exc, context):
    if isinstance(exc, Http404):
        return Response({
            'success': False,
            'error': {
                'code': 'not_found',
                'message': 'The requested resource was not found.',
            },
        }, status=404)

    if isinstance(exc, exceptions.PermissionDenied):
        return Response({
            'success': False,
            'error': {
                'code': 'permission_denied',
                'message': 'You do not have permission to perform this action.',
            },
        }, status=403)

    if isinstance(exc, exceptions.AuthenticationFailed):
        return Response({
            'success': False,
            'error': {
                'code': 'authentication_failed',
                'message': 'Authentication credentials were not provided or are invalid.',
            },
        }, status=401)

    if isinstance(exc, exceptions.ValidationError):
        return Response({
            'success': False,
            'error': {
                'code': 'validation_error',
                'message': 'Validation failed.',
                'details': exc.detail,
            },
        }, status=400)

    if isinstance(exc, exceptions.APIException):
        return Response({
            'success': False,
            'error': {
                'code': getattr(exc, 'default_code', 'request_failed'),
                'message': getattr(exc, 'detail', 'Request failed.'),
            },
        }, status=exc.status_code)

    return Response({
        'success': False,
        'error': {
            'code': 'server_error',
            'message': 'An unexpected error occurred.',
        },
    }, status=500)


class StandardizedModelViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    pagination_class = StandardizedPagination
    search_fields = []
    ordering_fields = '__all__'
    ordering = ('-created_at',)


class StandardizedReadOnlyModelViewSet(viewsets.ReadOnlyModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    pagination_class = StandardizedPagination
    search_fields = []
    ordering_fields = '__all__'
    ordering = ('-created_at',)
