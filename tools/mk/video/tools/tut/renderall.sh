cd "$(dirname "$0")/../.."
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
declare -A N=([cost]=사용법_우리집공사비 [cad]=사용법_도면열고물량 [req]=사용법_견적신청 [acb]=사용법_관리비비교 [support]=사용법_지원금찾기 [disaster]=사용법_누수복구비 [auction]=사용법_경매수리비 [compare]=사용법_견적서검토 [kitchen]=사용법_싱크대설계 [Journey]=진행과정_계약부터입주까지)
mkdir -p out/v3
for k in ${@:-cost cad req acb support disaster auction compare kitchen Journey}; do
  c=$([ $k = Journey ] && echo Journey || echo Tut-$k)
  npx remotion render src/index.ts $c out/raw_$k.mp4 --concurrency=2 --browser-executable=$B >/dev/null 2>&1 || { echo "FAIL $k"; continue; }
  ffmpeg -loglevel error -y -i out/raw_$k.mp4 -c:v copy -af "acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=3,alimiter=limit=0.84:level=false,loudnorm=I=-14:TP=-1.2:LRA=9" -ar 48000 -c:a aac -b:a 192k "out/v3/집지니_${N[$k]}.mp4"
  echo "done $k"
done
echo ALLDONE
