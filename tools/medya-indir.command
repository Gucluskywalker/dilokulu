#!/bin/bash
# ============================================================
#  Deutsch, wieder…  ·  Medya indirme
#  Görselleri ve ses dosyalarını uygulamanın içine indirir.
#  Mac'te bu dosyaya ÇİFT TIKLAYIN.
# ============================================================
cd "$(dirname "$0")/.." || exit 1

LIST="tools/media-list.tsv"
if [ ! -f "$LIST" ]; then
  echo "HATA: $LIST bulunamadı."
  echo "Bu betiği uygulama klasörünün içindeki tools/ klasöründen çalıştırın."
  read -n 1 -s -r -p "Kapatmak için bir tuşa basın..."
  exit 1
fi

TOTAL=$(grep -c . "$LIST")
OK=0; SKIP=0; FAIL=0; N=0

echo ""
echo "  Deutsch, wieder… — medya indiriliyor"
echo "  $TOTAL dosya · yaklaşık 60–90 MB"
echo "  ----------------------------------------"
echo ""

while IFS=$'\t' read -r LOCAL REMOTE; do
  [ -z "$LOCAL" ] && continue
  N=$((N+1))
  printf "  [%2d/%2d] %-34s " "$N" "$TOTAL" "$(basename "$LOCAL")"

  if [ -s "$LOCAL" ]; then
    echo "zaten var"
    SKIP=$((SKIP+1))
    continue
  fi

  mkdir -p "$(dirname "$LOCAL")"
  if curl -fsSL --retry 3 --retry-delay 2 --max-time 180 -o "$LOCAL.part" "$REMOTE"; then
    mv "$LOCAL.part" "$LOCAL"
    echo "indirildi"
    OK=$((OK+1))
  else
    rm -f "$LOCAL.part"
    echo "BAŞARISIZ"
    FAIL=$((FAIL+1))
  fi
done < "$LIST"

echo ""
echo "  ----------------------------------------"
echo "  İndirilen: $OK   ·   Atlanan: $SKIP   ·   Başarısız: $FAIL"
SIZE=$(du -sh media 2>/dev/null | cut -f1)
echo "  Toplam boyut: ${SIZE:-0}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  Bazı dosyalar inmedi. Betiği tekrar çalıştırın —"
  echo "  inenler atlanır, sadece eksikler denenir."
  echo ""
  echo "  Not: Bu bağlantılar Higgsfield CDN'inde. Süresi dolmuşsa"
  echo "  Claude'a söyleyin, medyayı yeniden üretir."
else
  echo "  Hazır. Artık uygulama çevrimdışı da çalışır."
fi
echo ""
read -n 1 -s -r -p "  Kapatmak için bir tuşa basın..."
echo ""
