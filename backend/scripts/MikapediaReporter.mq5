//+------------------------------------------------------------------+
//|  MikapediaReporter.mq5                                           |
//|  Kirim data posisi + limit orders ke backend MIKAPEDIA           |
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
#property version   "2.00"
#property strict

input string BACKEND_URL  = "https://mikapedia.online/api/v1/mt5/ea-report/";
input string EA_TOKEN     = "mikapedia_prod_2026_7f9e2d1a6c3b8e4f";
input int    REPORT_EVERY = 1;

datetime g_lastReport = 0;

int OnInit()
{
   Print("[Mikapedia] Reporter v2.0 aktif. Backend: ", BACKEND_URL);
   SendReport();
   return INIT_SUCCEEDED;
}

void OnTick()
{
   if (TimeCurrent() - g_lastReport >= REPORT_EVERY)
   {
      SendReport();
      g_lastReport = TimeCurrent();
   }
}

void SendReport()
{
   string json = "{";
   json += "\"token\":\"" + EA_TOKEN + "\",";
   json += "\"login\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
   json += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\",";
   json += "\"broker\":\"" + AccountInfoString(ACCOUNT_COMPANY) + "\",";
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
      json += "\"time_open\":\""  + TimeToString(tOpen, TIME_DATE|TIME_SECONDS)                   + "\"";
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
      json += "\"time_setup\":\""+ TimeToString(oTime, TIME_DATE|TIME_SECONDS)                + "\"";
      json += "}";
      ordCount++;
   }
   json += "],";

   // ── Recent Deals (last 24h, entry only) ──────────────────────────
   json += "\"deals\":[";
   HistorySelect(TimeCurrent() - 86400, TimeCurrent());
   int dealTotal = HistoryDealsTotal();
   int dealCount = 0;
   for (int i = MathMax(0, dealTotal - 20); i < dealTotal; i++)
   {
      ulong dTicket = HistoryDealGetTicket(i);
      if (dTicket <= 0) continue;
      if (HistoryDealGetInteger(dTicket, DEAL_ENTRY) != DEAL_ENTRY_IN) continue;

      if (dealCount > 0) json += ",";
      string dType  = HistoryDealGetInteger(dTicket, DEAL_TYPE) == DEAL_TYPE_BUY ? "BUY" : "SELL";
      datetime dTime = (datetime)HistoryDealGetInteger(dTicket, DEAL_TIME);

      json += "{";
      json += "\"ticket\":"      + IntegerToString(dTicket)                                           + ",";
      json += "\"order\":"       + IntegerToString(HistoryDealGetInteger(dTicket, DEAL_ORDER))         + ",";
      json += "\"symbol\":\""   + HistoryDealGetString(dTicket, DEAL_SYMBOL)                          + "\",";
      json += "\"type\":\""      + dType                                                               + "\",";
      json += "\"entry\":\"IN\","                                                                      ;
      json += "\"volume\":"      + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_VOLUME),  2)      + ",";
      json += "\"price\":"       + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_PRICE),   5)      + ",";
      json += "\"profit\":"      + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_PROFIT),  2)      + ",";
      json += "\"swap\":"        + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_SWAP),    2)      + ",";
      json += "\"commission\":"  + DoubleToString(HistoryDealGetDouble(dTicket, DEAL_COMMISSION), 2)   + ",";
      json += "\"comment\":\""  + HistoryDealGetString(dTicket, DEAL_COMMENT)                          + "\",";
      json += "\"time\":\""      + TimeToString(dTime, TIME_DATE|TIME_SECONDS)                         + "\"";
      json += "}";
      dealCount++;
   }
   json += "]";
   json += "}";

   string url     = BACKEND_URL + "/api/v1/mt5/ea-report/";
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
}
