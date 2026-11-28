cd "$(dirname "$0")/../.."
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
declare -A N=([cost]=우리집공사비 [cad]=도면열고물량 [req]=견적신청 [acb]=관리비비교 [support]=지원금찾기 [disaster]=누수복구비 [auction]=경매수리비 [compare]=견적서검토 [kitchen]=싱크대설계)
mkdir -p out
for k in cost cad req acb support disaster auction compare kitchen; do
  npx remotion render src/index.ts Tut-$k out/raw_$k.mp4 --concurrency=2 --browser-executable=$B >/dev/null 2>&1 || { echo "FAIL $k"; continue; }
  ffmpeg -loglevel error -y -i out/raw_$k.mp4 -c:v copy -af "acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=3,volume=0.8dB,alimiter=limit=0.84:level=false" -ar 48000 -c:a aac -b:a 192k "out/집지니_사용법_${N[$k]}.mp4"
  echo "done $k $(ffprobe -v error -show_entries format=duration -of csv=p=0 "out/집지니_사용법_${N[$k]}.mp4")"
done
echo ALLDONE
