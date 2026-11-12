#!/bin/sh
# 오토캐드 고유 형식 묶음 만들기: npm i && sh build.sh  → ../../assets/cad_dwg.js
cd "$(dirname "$0")" && npx esbuild entry.mjs --bundle --minify --format=iife --target=es2018 --legal-comments=eof --banner:js='/*! 집지니 캐드 고유 형식 묶음 — 바탕 프로그램 acad-ts (MIT 사용 허락, Copyright (c) 2026 Jochen Kühner, (c) 2021 Albert Domenech). 사용 허락 전문은 assets/cad_dwg.LICENSE.txt */' --outfile=../../assets/cad_dwg.js
