//+------------------------------------------------------------------+
//|  MikapediaReporter.mq5                                           |
//|  Kirim posisi, pending order, dan deal history ke MIKAPEDIA       |
//|                                                                  |
//|  CARA PASANG:                                                    |
//|  1. Copy ke folder MQL5/Experts                                  |
//|  2. Compile di MetaEditor (F7)                                   |
//|  3. Drag ke chart mana saja (XAUUSD M15)                          |
//|  4. Isi BACKEND_URL dan EA_TOKEN di parameter                    |
//|  5. Tools → Options → Expert Advisors → Allow WebRequest         |
//|     Tambahkan URL backend ke whitelist                           |
//+------------------------------------------------------------------+
#property copyright "MIKAPEDIA"
#property version   "2.10"
#property strict

input string BACKEND_URL  = "https://mikapedia.online/api/v1/mt5/ea-report/";
input string EA_TOKEN     = "mikapedia_prod_2026_7f9e2d1a6c3b8e4f";
input int    REPORT_EVERY = 1;
input datetime HISTORY_START_DATE = D'2000.01.01 00:00';
input int    HISTORY_BATCH_SIZE = 100;
input bool   RESET_HISTORY_CURSOR = false;

datetime g_historyCursor = 0;
long g_lastHistoryTicket = 0;
datetime g_pendingHistoryTime = 0;
long g_pendingHistoryTicket = 0;
bool g_historyProgress = false;
bool g_historyCompleteLogged = false;
string g_historyTimeKey = "";
string g_historyTicketKey = "";

int OnInit()
{
   string login = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   g_historyTimeKey = "MikaHistTime_" + login;
   g_historyTicketKey = "MikaHistTicket_" + login;
   if (RESET_HISTORY_CURSOR || !GlobalVariableCheck(g_historyTimeKey))
   {
      g_historyCursor = HISTORY_START_DATE;
      g_lastHistoryTicket = 0;
      GlobalVariableSet(g_historyTimeKey, (double)g_historyCursor);
      GlobalVariableSet(g_historyTicketKey, 0);
   }
   else
   {
      g_historyCursor = (datetime)GlobalVariableGet(g_historyTimeKey);
      g_lastHistoryTicket = (long)GlobalVariableGet(g_historyTicketKey);
   }

   int timerSeconds = REPORT_EVERY < 1 ? 1 : REPORT_EVERY;
   EventSetTimer(timerSeconds);
   Print("[Mikapedia] Reporter v2.10 aktif. Backend: ", BACKEND_URL);
   SendReport();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SendReport();
}

datetime BrokerTimeToWib(datetime brokerTime)
{
   int brokerUtcOffset = (int)(TimeTradeServer() - TimeGMT());
   return brokerTime - brokerUtcOffset + 7 * 3600;
}

string FormatWib(datetime brokerTime)
{
   MqlDateTime parts;
   TimeToStruct(BrokerTimeToWib(brokerTime), parts);
   return StringFormat(
      "%04d-%02d-%02dT%02d:%02d:%02d+07:00",
      parts.year, parts.mon, parts.day,
      parts.hour, parts.min, parts.sec
   );
}

double PipSizeForSymbol(string symbol)
{
   long calcMode = SymbolInfoInteger(symbol, SYMBOL_TRADE_CALC_MODE);
   if (calcMode != SYMBOL_CALC_MODE_FOREX && calcMode != SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE)
      return 0.0;

   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if (point <= 0.0)
      return 0.0;
   return point * ((digits == 3 || digits == 5) ? 10.0 : 1.0);
}

void SendReport()
{
   g_historyProgress = false;
   string json = "{";
   json += "\"token\":\"" + EA_TOKEN + "\",";
   json += "\"login\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
   json += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\",";
   json += "\"broker\":\"" + AccountInfoString(ACCOUNT_COMPANY) + "\",";
   json += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"floating_pnl\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";

   // ── Open Positions ────────────────────────────────────────────────
   json += "\"positions\":[";
   int posTotal = PositionsTotal();
   for (int i = 0; i < posTotal; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket <= 0) continue;
      if (i > 0) json += ",";

      string posType = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL";
      datetime tOpen = (datetime)PositionGetInteger(POSITION_TIME);

      json += "{";
      json += "\"ticket\":"      + IntegerToString(ticket)                                        + ",";
      json += "\"symbol\":\""    + PositionGetString(POSITION_SYMBOL)                             + "\",";
      json += "\"type\":\""      + posType                                                         + "\",";
      json += "\"volume\":"      + DoubleToString(PositionGetDouble(POSITION_VOLUME),    2)        + ",";
      json += "\"price_open\":"  + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5)       + ",";
      json += "\"price_current\":"+ DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), 5)  + ",";
      json += "\"sl\":"          + DoubleToString(PositionGetDouble(POSITION_SL),        5)        + ",";
      json += "\"tp\":"          + DoubleToString(PositionGetDouble(POSITION_TP),        5)        + ",";
      json += "\"profit\":"      + DoubleToString(PositionGetDouble(POSITION_PROFIT),    2)        + ",";
      json += "\"swap\":"        + DoubleToString(PositionGetDouble(POSITION_SWAP),      2)        + ",";
      json += "\"comment\":\""   + PositionGetString(POSITION_COMMENT)                            + "\",";
      json += "\"magic\":"       + IntegerToString(PositionGetInteger(POSITION_MAGIC))             + ",";
      json += "\"time_open\":\""  + FormatWib(tOpen)                                                + "\"";
      json += "}";
   }
   json += "],";

   // ── Pending Orders (Limit/Stop — belum tersentuh) ─────────────────
   json += "\"pending_orders\":[";
   int ordTotal  = OrdersTotal();
   int ordCount  = 0;
   for (int i = 0; i < ordTotal; i++)
   {
      ulong oTicket = OrderGetTicket(i);
      if (oTicket <= 0) continue;

      ENUM_ORDER_TYPE oType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      string oTypeStr = "";
      if      (oType == ORDER_TYPE_BUY_LIMIT)  oTypeStr = "BUY LIMIT";
      else if (oType == ORDER_TYPE_SELL_LIMIT) oTypeStr = "SELL LIMIT";
      else if (oType == ORDER_TYPE_BUY_STOP)   oTypeStr = "BUY STOP";
      else if (oType == ORDER_TYPE_SELL_STOP)  oTypeStr = "SELL STOP";
      else continue;

      if (ordCount > 0) json += ",";
      datetime oTime = (datetime)OrderGetInteger(ORDER_TIME_SETUP);

      json += "{";
      json += "\"ticket\":"    + IntegerToString(oTicket)                                     + ",";
      json += "\"symbol\":\""  + OrderGetString(ORDER_SYMBOL)                                 + "\",";
      json += "\"type\":\""    + oTypeStr                                                      + "\",";
      json += "\"volume\":"    + DoubleToString(OrderGetDouble(ORDER_VOLUME_CURRENT), 2)       + ",";
      json += "\"price_open\":"+ DoubleToString(OrderGetDouble(ORDER_PRICE_OPEN),    5)        + ",";
      json += "\"sl\":"        + DoubleToString(OrderGetDouble(ORDER_SL),            5)        + ",";
      json += "\"tp\":"        + DoubleToString(OrderGetDouble(ORDER_TP),            5)        + ",";
      json += "\"comment\":\""+ OrderGetString(ORDER_COMMENT)                                  + "\",";
      json += "\"magic\":"     + IntegerToString(OrderGetInteger(ORDER_MAGIC))                 + ",";
      json += "\"time_setup\":\""+ FormatWib(oTime)                                             + "\"";
      json += "}";
      ordCount++;
   }
   json += "],";

   // ── Historical deals are sent in bounded, retryable batches ──────
   json += "\"deals\":[";
   HistorySelect(g_historyCursor, TimeCurrent());
   int dealTotal = HistoryDealsTotal();
   int dealCount = 0;
   int startIndex = 0;
   if (g_lastHistoryTicket > 0)
   {
      for (int i = 0; i < dealTotal; i++)
      {
         if ((long)HistoryDealGetTicket(i) == g_lastHistoryTicket)
         {
            startIndex = i + 1;
            break;
         }
      }
   }

   int examined = 0;
   for (int i = startIndex; i < dealTotal && examined < MathMax(1, HISTORY_BATCH_SIZE); i++)
   {
      ulong dTicket = HistoryDealGetTicket(i);
      if (dTicket <= 0) continue;

      datetime dTime = (datetime)HistoryDealGetInteger(dTicket, DEAL_TIME);
      g_pendingHistoryTime = dTime;
      g_pendingHistoryTicket = (long)dTicket;
      g_historyProgress = true;
      examined++;

      long rawType = HistoryDealGetInteger(dTicket, DEAL_TYPE);
      long rawEntry = HistoryDealGetInteger(dTicket, DEAL_ENTRY);
      if ((rawType != DEAL_TYPE_BUY && rawType != DEAL_TYPE_SELL) ||
          (rawEntry != DEAL_ENTRY_IN && rawEntry != DEAL_ENTRY_OUT &&
           rawEntry != DEAL_ENTRY_INOUT && rawEntry != DEAL_ENTRY_OUT_BY))
         continue;

      if (dealCount > 0) json += ",";
      string dType = rawType == DEAL_TYPE_BUY ? "BUY" : "SELL";
      string dEntry = "IN";
      if      (rawEntry == DEAL_ENTRY_OUT)    dEntry = "OUT";
      else if (rawEntry == DEAL_ENTRY_INOUT)  dEntry = "INOUT";
      else if (rawEntry == DEAL_ENTRY_OUT_BY) dEntry = "OUT_BY";
      string dSymbol = HistoryDealGetString(dTicket, DEAL_SYMBOL);

      json += "{";
      json += "\"ticket\":"      + IntegerToString(dTicket)                                           + ",";
      json += "\"order\":"       + IntegerToString(HistoryDealGetInteger(dTicket, DEAL_ORDER))         + ",";
      json += "\"position_id\":" + IntegerToString(HistoryDealGetInteger(dTicket, DEAL_POSITION_ID))   + ",";
      json += "\"symbol\":\""   + dSymbol                                                             + "\",";
      json += "\"type\":\""      + dType                                                               + "\",";
      json += "\"entry\":\""     + dEntry                                                              + "\",";
      json += "\"volume\":"      + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_VOLUME),  2)      + ",";
      json += "\"price\":"       + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_PRICE),   5)      + ",";
      json += "\"pip_size\":"    + DoubleToString(PipSizeForSymbol(dSymbol), 8)                        + ",";
      json += "\"profit\":"      + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_PROFIT),  2)      + ",";
      json += "\"swap\":"        + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_SWAP),    2)      + ",";
      json += "\"commission\":"  + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_COMMISSION), 2)   + ",";
      json += "\"comment\":\""  + HistoryDealGetString(dTicket, DEAL_COMMENT)                          + "\",";
      json += "\"time\":\""      + FormatWib(dTime)                                                    + "\"";
      json += "}";
      dealCount++;
   }
   json += "]";
   json += "}";

   string url     = BACKEND_URL;
   if (StringSubstr(url, StringLen(url) - 1, 1) != "/")
      url += "/";
   string headers = "Content-Type: application/json\r\nngrok-skip-browser-warning: 1\r\n";
   char   postData[];
   char   result[];
   string resultHeaders;
   StringToCharArray(json, postData, 0, StringLen(json));

   int res = WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);
   if (res == -1)
      Print("[Mikapedia] WebRequest error — tambahkan URL ke whitelist (Tools→Options→Expert Advisors)");
   else if (res != 200)
      Print("[Mikapedia] HTTP ", res, " — ", CharArrayToString(result));
   else if (g_historyProgress)
   {
      g_historyCursor = g_pendingHistoryTime;
      g_lastHistoryTicket = g_pendingHistoryTicket;
      GlobalVariableSet(g_historyTimeKey, (double)g_historyCursor);
      GlobalVariableSet(g_historyTicketKey, (double)g_lastHistoryTicket);
      g_historyCompleteLogged = false;
      Print("[Mikapedia] Deal history batch synced: ", dealCount, " deals.");
   }
   else if (!g_historyCompleteLogged)
   {
      Print("[Mikapedia] Deal history is up to date.");
      g_historyCompleteLogged = true;
   }
}
