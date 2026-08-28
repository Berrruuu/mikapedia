from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .service import collect_status
from common.response import success_response


class MonitoringView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        status = collect_status()
        return success_response(status)
