#!/bin/bash
# ============================================================
#  Deutsch, wieder…  ·  Medya hazırlama
#
#  Görselleri telefon boyutuna küçültür ve JPEG'e çevirir.
#  151 MB → yaklaşık 10 MB. GitHub'a rahat sığar,
#  telefonda çok daha hızlı açılır.
#
#  Elinizde PNG'ler varsa yeniden indirmez, onları kullanır.
#  Eksik olanları indirir.
#
#  Mac'te bu dosyaya ÇİFT TIKLAYIN.
# ============================================================
cd "$(dirname "$0")/.." || exit 1

LIST="tools/media-list.tsv"
MAXPX=1600      # en uzun kenar
QUALITY=78      # JPEG kalitesi

if [ ! -f "$LIST" ]; then
  echo "HATA: $LIST bulunamadı."
  read -n 1 -s -r -p "Kapatmak için bir tuşa basın..."; exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "HATA: sips bulunamadı. Bu betik macOS içindir."
  read -n 1 -s -r -p "Kapatmak için bir tuşa basın..."; exit 1
fi

TOTAL=$(grep -c . "$LIST")
N=0; MADE=0; SKIP=0; DL=0; FAIL=0

echo ""
echo "  Deutsch, wieder… — medya hazırlanıyor"
echo "  $TOTAL dosya · en uzun kenar ${MAXPX}px · JPEG kalite $QUALITY"
echo "  ------------------------------------------------------"
echo ""

while IFS=$'\t' read -r FINAL REMOTE; do
  [ -z "$FINAL" ] && continue
  N=$((N+1))
  BASE=$(basename "$FINAL")
  printf "  [%2d/%2d] %-24s " "$N" "$TOTAL" "$BASE"

  if [ -s "$FINAL" ]; then
    echo "hazır"; SKIP=$((SKIP+1)); continue
  fi

  mkdir -p "$(dirname "$FINAL")"

  # Ses: sadece indir
  case "$FINAL" in
    *.mp3)
      if curl -fsSL --retry 3 --max-time 180 -o "$FINAL.part" "$REMOTE"; then
        mv "$FINAL.part" "$FINAL"; echo "indirildi"; DL=$((DL+1))
      else
        rm -f "$FINAL.part"; echo "BAŞARISIZ"; FAIL=$((FAIL+1))
      fi
      continue ;;
  esac

  # Görsel: önce elimizdeki PNG'ye bak
  SRC="${FINAL%.jpg}.png"
  HAD_LOCAL=0
  if [ -s "$SRC" ]; then
    HAD_LOCAL=1
  else
    SRC="$FINAL.src"
    if ! curl -fsSL --retry 3 --max-time 180 -o "$SRC" "$REMOTE"; then
      rm -f "$SRC"; echo "İNDİRİLEMEDİ"; FAIL=$((FAIL+1)); continue
    fi
    DL=$((DL+1))
  fi

  if sips -Z $MAXPX \
          --setProperty format jpeg \
          --setProperty formatOptions $QUALITY \
          "$SRC" --out "$FINAL" >/dev/null 2>&1; then
    NEW=$(du -h "$FINAL" | cut -f1 | tr -d ' ')
    if [ "$HAD_LOCAL" = "1" ]; then
      OLD=$(du -h "$SRC" | cut -f1 | tr -d ' ')
      rm -f "$SRC"
      echo "$OLD → $NEW"
    else
      rm -f "$SRC"
      echo "indirildi → $NEW"
    fi
    MADE=$((MADE+1))
  else
    rm -f "$FINAL" "$FINAL.src"
    echo "ÇEVRİLEMEDİ"; FAIL=$((FAIL+1))
  fi
done < "$LIST"

# Artakalan PNG'leri temizle
LEFT=$(find media -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
if [ "$LEFT" -gt 0 ]; then
  echo ""
  echo "  $LEFT eski PNG kaldı, siliniyor…"
  find media -name '*.png' -delete
fi

echo ""
echo "  ------------------------------------------------------"
echo "  Hazırlanan: $MADE   ·   Zaten hazır: $SKIP   ·   Sorunlu: $FAIL"
echo "  Toplam boyut: $(du -sh media 2>/dev/null | cut -f1 | tr -d ' ')"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  Bazı dosyalar olmadı. Betiği tekrar çalıştırın —"
  echo "  hazır olanlar atlanır, sadece eksikler denenir."
else
  echo "  Hazır. Artık media klasörünü GitHub'a yükleyebilirsiniz."
fi
echo ""
read -n 1 -s -r -p "  Kapatmak için bir tuşa basın..."
echo ""
