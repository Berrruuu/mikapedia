from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BacktestJournalDetailView,
    BacktestJournalListCreateView,
    BacktestTradeDetailView,
    BacktestTradeListCreateView,
    MT5AccountViewSet,
    ea_report,
    trades_by_signal,
)

router = DefaultRouter()
router.register(r'', MT5AccountViewSet, basename='mt5')

urlpatterns = [
    path('ea-report/', ea_report, name='ea-report'),
    path('trades/', trades_by_signal, name='trades-by-signal'),
    path('backtests/', BacktestJournalListCreateView.as_view(), name='backtest-list'),
    path('backtests/<uuid:journal_id>/', BacktestJournalDetailView.as_view(), name='backtest-detail'),
    path('backtests/<uuid:journal_id>/trades/', BacktestTradeListCreateView.as_view(), name='backtest-trades'),
    path(
        'backtests/<uuid:journal_id>/trades/<uuid:trade_id>/',
        BacktestTradeDetailView.as_view(),
        name='backtest-trade-detail',
    ),
    path('', include(router.urls)),
]
