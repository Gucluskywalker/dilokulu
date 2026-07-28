#!/bin/bash
# ============================================================
#  Deutsch, wieder…  ·  Yerel test sunucusu
#  Uygulamayı Mac'te denemek için. Çift tıklayın.
#  Kapatmak için bu pencerede Ctrl+C.
# ============================================================
cd "$(dirname "$0")/.." || exit 1

PORT=8765
echo ""
echo "  Deutsch, wieder… — yerel sunucu"
echo "  ----------------------------------------"
echo "  Tarayıcıda açılıyor:  http://localhost:$PORT"
echo ""
echo "  iPhone/iPad ile aynı Wi-Fi'daysanız şu adresi de deneyebilirsiniz:"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
[ -n "$IP" ] && echo "  http://$IP:$PORT"
echo ""
echo "  Kapatmak için: Ctrl + C"
echo "  ----------------------------------------"
echo ""

( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server $PORT
