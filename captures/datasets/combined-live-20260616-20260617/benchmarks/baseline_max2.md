# Benchmark Pixel com GT manual
- dataset: captures/datasets/combined-live-20260616-20260617
- config: roi=0.18,0.32,0.82,0.58 fastConf=70.0 maxBoxes=2 modes=dark.light
- arquivo de GT manual: captures/datasets/combined-live-20260616-20260617/ground_truth_verification.csv
- critério de GT manual: verified_code/status revisados; ground_truth_code automático é ignorado
- frames no manifest: 374
- frames processados (frame disponível): 373
- frames com ground-truth manual confirmado: 373
- frames faltando arquivo de frame: 0
- estratégia de busca: fallback_dark_no_primary_reads
- resolvidos positivos: 140/216
- precisão positiva: 100.00%
- recall positivo: 64.81%
- acertos por leitura exata/correção/confusão conhecida: 55/6/79
- acertos dependentes de correção textual: 85/140
- positivos não lidos: 76
- falsos positivos: 0 de 157 não-sticker processados
- frames positivos/negativos no GT manual: 216/157
- seguradas positivas manuais: 54
- seguradas positivas avaliáveis (>= 2 frames manuais): 43
- seguradas avaliáveis confirmadas com 2 leituras: 38/43
- seguradas avaliáveis sem confirmação: 5
- seguradas com frames manuais insuficientes: 11
- commits errados em seguradas positivas: 0
- taxa de falso positivo por não-sticker: 0.00%
- média de leituras candidatas por frame: 140
- razão no-frame sem detecção (boxes=0): 1
- razão sem texto no crop (box com 0 ink): 60
- razão sem match apesar de OCR: 172
- mediana detecção/ocr (ms): 13.00 / 12.00
- p95 detecção/ocr (ms): 17.00 / 28.00
- média boxes: 2.22
- média crops: 1.39
- total crops OCR: 518
- p95/max crops OCR: 3/6
- média de crops com ink: 0.83
- fallback dark tentado/usado: 134/44

## Seguradas positivas avaliáveis sem confirmação
- MEX15 em pixel-live-20260617-090351 frames 72-78: acertos=0/5 commits_errados=-
- AUS6 em pixel-live-20260617-090351 frames 154-157: acertos=1/4 commits_errados=-
- NED12 em pixel-live-20260617-090351 frames 186-190: acertos=1/4 commits_errados=-
- RSA19 em pixel-live-20260617-090351 frames 193-194: acertos=1/2 commits_errados=-
- SCO16 em pixel-live-20260617-090351 frames 201-206: acertos=1/6 commits_errados=-

## Acertos (GT manual)
- live-setup-20260616-201017__frame-2: IRQ20
- live-setup-20260616-201017__frame-3: NED12
- live-setup-20260616-201017__frame-4: SWE8
- live-setup-20260616-201017__frame-5: SWE8
- live-user-20260616-201108__frame-46: SWE8
- live-user-20260616-201108__frame-47: SWE8
- live-user-20260616-201108__frame-48: SWE8
- live-user-20260616-201108__frame-49: SWE8
- live-user-20260616-201108__frame-50: SWE8
- live-user-20260616-201108__frame-51: SWE8
- live-user-20260617-011113__frame-16: RSA19
- live-user-20260617-011113__frame-17: RSA19
- live-user-20260617-011113__frame-25: AUT4
- live-user-20260617-011113__frame-27: AUT4
- live-user-20260617-011113__frame-38: RSA17
- live-user-20260617-011113__frame-41: PAN1
- live-user-20260617-011113__frame-48: MEX15
- live-user-20260617-011113__frame-49: MEX15
- live-user-20260617-011113__frame-54: GHA19
- live-user-20260617-011113__frame-55: GHA19
- live-user-20260617-011113__frame-59: CIV12
- live-user-20260617-011113__frame-63: RSA6
- live-user-20260617-011113__frame-64: RSA6
- live-user-20260617-011113__frame-65: RSA6
- live-user-20260617-011113__frame-68: RSA6
- live-user-20260617-011113__frame-71: AUT8
- live-user-20260617-011113__frame-79: AUS2
- live-user-20260617-011113__frame-91: NZL18
- live-user-20260617-011113__frame-92: NZL18
- live-user-20260617-011113__frame-93: NZL18
- live-user-20260617-011113__frame-96: CIV4
- live-user-20260617-011113__frame-97: CIV4
- live-user-20260617-011113__frame-98: CIV4
- live-user-20260617-011113__frame-100: CIV4
- live-user-20260617-011113__frame-104: NOR20
- live-user-20260617-011113__frame-105: NOR20
- live-user-20260617-011113__frame-108: AUS18
- live-user-20260617-011113__frame-109: AUS18
- live-user-20260617-011113__frame-110: AUS18
- live-user-20260617-011113__frame-111: AUS18
- live-user-20260617-011113__frame-112: AUS18
- live-user-20260617-011113__frame-113: AUS18
- live-user-20260617-011113__frame-114: AUS18
- live-user-20260617-011113__frame-115: AUS18
- pixel-live-20260617-090351__frame-26: RSA13
- pixel-live-20260617-090351__frame-30: RSA13
- pixel-live-20260617-090351__frame-31: RSA13
- pixel-live-20260617-090351__frame-84: MEX15
- pixel-live-20260617-090351__frame-88: MEX15
- pixel-live-20260617-090351__frame-97: CIV12
- pixel-live-20260617-090351__frame-102: GHA19
- pixel-live-20260617-090351__frame-118: GER4
- pixel-live-20260617-090351__frame-119: GER4
- pixel-live-20260617-090351__frame-124: PAN1
- pixel-live-20260617-090351__frame-125: PAN1
- pixel-live-20260617-090351__frame-128: RSA17
- pixel-live-20260617-090351__frame-129: RSA17
- pixel-live-20260617-090351__frame-131: RSA17
- pixel-live-20260617-090351__frame-135: NOR20
- pixel-live-20260617-090351__frame-136: NOR20
- pixel-live-20260617-090351__frame-138: NOR20
- pixel-live-20260617-090351__frame-139: NOR20
- pixel-live-20260617-090351__frame-142: CIV4
- pixel-live-20260617-090351__frame-143: CIV4
- pixel-live-20260617-090351__frame-144: CIV4
- pixel-live-20260617-090351__frame-146: CIV4
- pixel-live-20260617-090351__frame-147: NZL18
- pixel-live-20260617-090351__frame-149: NZL18
- pixel-live-20260617-090351__frame-150: NZL18
- pixel-live-20260617-090351__frame-156: AUS6
- pixel-live-20260617-090351__frame-161: AUS2
- pixel-live-20260617-090351__frame-162: AUS2
- pixel-live-20260617-090351__frame-165: AUT8
- pixel-live-20260617-090351__frame-166: AUT8
- pixel-live-20260617-090351__frame-167: AUT8
- pixel-live-20260617-090351__frame-168: AUT8
- pixel-live-20260617-090351__frame-169: AUT8
- pixel-live-20260617-090351__frame-173: RSA6
- pixel-live-20260617-090351__frame-177: RSA6
- pixel-live-20260617-090351__frame-179: EGY4
- pixel-live-20260617-090351__frame-180: EGY4
- pixel-live-20260617-090351__frame-183: EGY4
- pixel-live-20260617-090351__frame-187: NED12
- pixel-live-20260617-090351__frame-194: RSA19
- pixel-live-20260617-090351__frame-198: SWE8
- pixel-live-20260617-090351__frame-199: SWE8
- pixel-live-20260617-090351__frame-203: SCO16
- pixel-live-20260617-090351__frame-208: SUI14
- pixel-live-20260617-090351__frame-209: SUI14
- pixel-live-20260617-090351__frame-213: AUT4
- pixel-live-20260617-090351__frame-214: AUT4
- pixel-live-20260617-090351__frame-215: AUT4
- pixel-live-20260617-090351__frame-216: AUT4
- pixel-live-20260617-090351__frame-217: AUT4
- pixel-live-20260617-090351__frame-221: EGY5
- pixel-live-20260617-090351__frame-222: EGY5
- pixel-live-20260617-090351__frame-227: TUN10
- pixel-live-20260617-090351__frame-228: TUN10
- pixel-live-20260617-090351__frame-231: TUN10
- pixel-live-20260617-090351__frame-232: TUN10
- pixel-live-20260617-090351__frame-237: TUN10
- pixel-live-20260617-090351__frame-240: MEX15
- pixel-live-20260617-090351__frame-243: MEX15
- pixel-live-20260617-090351__frame-245: MEX15
- pixel-live-20260617-090351__frame-250: MEX19
- pixel-live-20260617-090351__frame-251: MEX19
- pixel-live-20260617-090351__frame-252: MEX19
- pixel-live-20260617-090351__frame-254: MEX19
- pixel-live-20260617-090351__frame-255: MEX19
- pixel-live-20260617-090351__frame-258: ALG1
- pixel-live-20260617-090351__frame-259: ALG1
- pixel-live-20260617-090351__frame-262: QAT17
- pixel-live-20260617-090351__frame-264: QAT17
- pixel-live-20260617-090351__frame-266: QAT17
- pixel-live-20260617-090351__frame-267: QAT17
- pixel-live-20260617-090351__frame-271: QAT17
- pixel-live-20260617-090351__frame-276: QAT17
- pixel-live-20260617-090351__frame-279: IRN10
- pixel-live-20260617-090351__frame-280: IRN10
- pixel-live-20260617-090351__frame-281: IRN10
- pixel-live-20260617-090351__frame-282: IRN10
- pixel-live-20260617-090351__frame-286: IRN15
- pixel-live-20260617-090351__frame-287: IRN15
- pixel-live-20260617-090351__frame-288: IRN15
- pixel-live-20260617-090351__frame-289: IRN15
- pixel-live-20260617-090351__frame-293: IRN15
- pixel-live-20260617-090351__frame-296: BIH12
- pixel-live-20260617-090351__frame-297: BIH12
- pixel-live-20260617-090351__frame-299: BIH12
- pixel-live-20260617-090351__frame-301: BIH12
- pixel-live-20260617-090351__frame-303: BIH12
- pixel-live-20260617-090351__frame-309: CUW4
- pixel-live-20260617-090351__frame-311: CUW4
- pixel-live-20260617-090351__frame-312: CUW4
- pixel-live-20260617-090351__frame-313: CUW4
- pixel-live-20260617-090351__frame-316: POR10
- pixel-live-20260617-090351__frame-317: POR10
- pixel-live-20260617-090351__frame-322: IRQ20
- pixel-live-20260617-090351__frame-327: IRQ20
- pixel-live-20260617-090351__frame-329: IRQ20

## Cobertura por código manual
- ALG1: acertos=2/2 leitura_exata=0 correção=0 confusão=2 splits=train:2 crops_média=1.00 crops_max=1
- AUS18: acertos=8/8 leitura_exata=7 correção=0 confusão=1 splits=test:1, train:6, val:1 crops_média=1.13 crops_max=2
- AUS2: acertos=3/4 leitura_exata=1 correção=0 confusão=2 splits=test:1, train:3 crops_média=0.75 crops_max=1
- AUS6: acertos=1/4 leitura_exata=0 correção=0 confusão=1 splits=train:3, val:1 crops_média=2.75 crops_max=4
- AUT4: acertos=7/7 leitura_exata=1 correção=0 confusão=6 splits=train:6, val:1 crops_média=1.00 crops_max=1
- AUT8: acertos=6/6 leitura_exata=1 correção=0 confusão=5 splits=train:5, val:1 crops_média=1.33 crops_max=3
- BIH12: acertos=5/8 leitura_exata=0 correção=2 confusão=3 splits=test:1, train:6, val:1 crops_média=2.13 crops_max=5
- CIV12: acertos=2/2 leitura_exata=1 correção=0 confusão=1 splits=train:2 crops_média=1.00 crops_max=1
- CIV4: acertos=8/9 leitura_exata=2 correção=2 confusão=4 splits=test:1, train:6, val:2 crops_média=1.33 crops_max=2
- CUW4: acertos=4/8 leitura_exata=0 correção=0 confusão=4 splits=train:7, val:1 crops_média=2.13 crops_max=5
- EGY4: acertos=3/4 leitura_exata=0 correção=0 confusão=3 splits=train:3, val:1 crops_média=1.25 crops_max=2
- EGY5: acertos=2/5 leitura_exata=1 correção=0 confusão=1 splits=test:1, train:4 crops_média=2.40 crops_max=6
- GER4: acertos=2/3 leitura_exata=0 correção=0 confusão=2 splits=test:1, train:2 crops_média=1.33 crops_max=2
- GHA19: acertos=3/4 leitura_exata=2 correção=0 confusão=1 splits=train:4 crops_média=1.25 crops_max=2
- IRN10: acertos=4/5 leitura_exata=0 correção=0 confusão=4 splits=train:4, val:1 crops_média=1.20 crops_max=2
- IRN15: acertos=5/7 leitura_exata=0 correção=0 confusão=5 splits=test:1, train:6 crops_média=1.29 crops_max=2
- IRQ20: acertos=4/8 leitura_exata=1 correção=0 confusão=3 splits=test:1, train:6, val:1 crops_média=1.38 crops_max=3
- MEX15: acertos=7/18 leitura_exata=6 correção=0 confusão=1 splits=test:2, train:14, val:2 crops_média=1.50 crops_max=4
- MEX19: acertos=5/6 leitura_exata=4 correção=0 confusão=1 splits=train:5, val:1 crops_média=1.33 crops_max=2
- NED12: acertos=2/5 leitura_exata=2 correção=0 confusão=0 splits=test:1, train:4 crops_média=2.20 crops_max=4
- NOR20: acertos=6/8 leitura_exata=2 correção=0 confusão=4 splits=test:1, train:7 crops_média=1.25 crops_max=2
- NZL18: acertos=6/7 leitura_exata=4 correção=0 confusão=2 splits=test:2, train:4, val:1 crops_média=1.14 crops_max=2
- PAN1: acertos=3/5 leitura_exata=2 correção=1 confusão=0 splits=train:4, val:1 crops_média=2.40 crops_max=6
- POR10: acertos=2/6 leitura_exata=0 correção=0 confusão=2 splits=test:1, train:5 crops_média=1.67 crops_max=4
- QAT17: acertos=6/12 leitura_exata=0 correção=0 confusão=6 splits=test:2, train:9, val:1 crops_média=1.33 crops_max=4
- RSA13: acertos=3/7 leitura_exata=2 correção=0 confusão=1 splits=test:1, train:5, val:1 crops_média=1.29 crops_max=2
- RSA17: acertos=4/4 leitura_exata=1 correção=0 confusão=3 splits=train:4 crops_média=1.00 crops_max=1
- RSA19: acertos=3/4 leitura_exata=2 correção=0 confusão=1 splits=test:1, train:3 crops_média=1.75 crops_max=4
- RSA6: acertos=6/10 leitura_exata=4 correção=0 confusão=2 splits=test:2, train:7, val:1 crops_média=1.60 crops_max=4
- SCO16: acertos=1/6 leitura_exata=0 correção=1 confusão=0 splits=test:1, train:4, val:1 crops_média=2.17 crops_max=4
- SUI14: acertos=2/2 leitura_exata=0 correção=0 confusão=2 splits=train:2 crops_média=1.00 crops_max=1
- SWE8: acertos=10/10 leitura_exata=8 correção=0 confusão=2 splits=test:1, train:8, val:1 crops_média=1.10 crops_max=2
- TUN10: acertos=5/12 leitura_exata=1 correção=0 confusão=4 splits=test:1, train:10, val:1 crops_média=1.75 crops_max=4

## Acertos dependentes de correção textual
- live-user-20260617-011113__frame-27: esperado=AUT4 via confusão conhecida leituras=NJT 4
- live-user-20260617-011113__frame-38: esperado=RSA17 via confusão conhecida leituras=RGA 17
- live-user-20260617-011113__frame-48: esperado=MEX15 via confusão conhecida leituras=NEX 15
- live-user-20260617-011113__frame-96: esperado=CIV4 via correção conservadora leituras=CV 4
- live-user-20260617-011113__frame-98: esperado=CIV4 via correção conservadora leituras=CV 4
- live-user-20260617-011113__frame-112: esperado=AUS18 via confusão conhecida leituras=NJS 18
- pixel-live-20260617-090351__frame-26: esperado=RSA13 via confusão conhecida leituras=HSA 13
- pixel-live-20260617-090351__frame-97: esperado=CIV12 via confusão conhecida leituras=CWV 12
- pixel-live-20260617-090351__frame-102: esperado=GHA19 via confusão conhecida leituras=DUA 19
- pixel-live-20260617-090351__frame-118: esperado=GER4 via confusão conhecida leituras=GEH 4
- pixel-live-20260617-090351__frame-119: esperado=GER4 via confusão conhecida leituras=ER 4
- pixel-live-20260617-090351__frame-124: esperado=PAN1 via correção conservadora leituras=FANI 1 | PANJ 1
- pixel-live-20260617-090351__frame-128: esperado=RSA17 via confusão conhecida leituras=HSA 17
- pixel-live-20260617-090351__frame-129: esperado=RSA17 via confusão conhecida leituras=RSM 17
- pixel-live-20260617-090351__frame-135: esperado=NOR20 via confusão conhecida leituras=dark:NEN 20
- pixel-live-20260617-090351__frame-136: esperado=NOR20 via confusão conhecida leituras=NEN 20
- pixel-live-20260617-090351__frame-138: esperado=NOR20 via confusão conhecida leituras=EN 20
- pixel-live-20260617-090351__frame-139: esperado=NOR20 via confusão conhecida leituras=MN 20
- pixel-live-20260617-090351__frame-142: esperado=CIV4 via confusão conhecida leituras=OV 4
- pixel-live-20260617-090351__frame-143: esperado=CIV4 via confusão conhecida leituras=SXV 4
- pixel-live-20260617-090351__frame-144: esperado=CIV4 via confusão conhecida leituras=CNV 4
- pixel-live-20260617-090351__frame-146: esperado=CIV4 via confusão conhecida leituras=SXV 4
- pixel-live-20260617-090351__frame-149: esperado=NZL18 via confusão conhecida leituras=NB 18
- pixel-live-20260617-090351__frame-150: esperado=NZL18 via confusão conhecida leituras=NB 18
- pixel-live-20260617-090351__frame-156: esperado=AUS6 via confusão conhecida leituras=MJS 6
- pixel-live-20260617-090351__frame-161: esperado=AUS2 via confusão conhecida leituras=NO 2
- pixel-live-20260617-090351__frame-162: esperado=AUS2 via confusão conhecida leituras=WAI 2
- pixel-live-20260617-090351__frame-165: esperado=AUT8 via confusão conhecida leituras=WIT 8
- pixel-live-20260617-090351__frame-166: esperado=AUT8 via confusão conhecida leituras=MTT 8 | WJT 8
- pixel-live-20260617-090351__frame-167: esperado=AUT8 via confusão conhecida leituras=MJT 8
- pixel-live-20260617-090351__frame-168: esperado=AUT8 via confusão conhecida leituras=MIT 8
- pixel-live-20260617-090351__frame-169: esperado=AUT8 via confusão conhecida leituras=WIU 8
- pixel-live-20260617-090351__frame-173: esperado=RSA6 via confusão conhecida leituras=NGA 6
- pixel-live-20260617-090351__frame-177: esperado=RSA6 via confusão conhecida leituras=NEA 6
- pixel-live-20260617-090351__frame-179: esperado=EGY4 via confusão conhecida leituras=ECY 4
- pixel-live-20260617-090351__frame-180: esperado=EGY4 via confusão conhecida leituras=ECY 4
- pixel-live-20260617-090351__frame-183: esperado=EGY4 via confusão conhecida leituras=FGY 4
- pixel-live-20260617-090351__frame-194: esperado=RSA19 via confusão conhecida leituras=FGA 19
- pixel-live-20260617-090351__frame-198: esperado=SWE8 via confusão conhecida leituras=GIE 8
- pixel-live-20260617-090351__frame-199: esperado=SWE8 via confusão conhecida leituras=SWT 8
- pixel-live-20260617-090351__frame-203: esperado=SCO16 via correção conservadora leituras=SC 016
- pixel-live-20260617-090351__frame-208: esperado=SUI14 via confusão conhecida leituras=EX 14
- pixel-live-20260617-090351__frame-209: esperado=SUI14 via confusão conhecida leituras=WX 14
- pixel-live-20260617-090351__frame-213: esperado=AUT4 via confusão conhecida leituras=MIT 4
- pixel-live-20260617-090351__frame-214: esperado=AUT4 via confusão conhecida leituras=WIT 4
- pixel-live-20260617-090351__frame-215: esperado=AUT4 via confusão conhecida leituras=MIT 4
- pixel-live-20260617-090351__frame-216: esperado=AUT4 via confusão conhecida leituras=NJT 4
- pixel-live-20260617-090351__frame-217: esperado=AUT4 via confusão conhecida leituras=WJT 4
- pixel-live-20260617-090351__frame-222: esperado=EGY5 via confusão conhecida leituras=ECY 5
- pixel-live-20260617-090351__frame-228: esperado=TUN10 via confusão conhecida leituras=UJMJ 10
- pixel-live-20260617-090351__frame-231: esperado=TUN10 via confusão conhecida leituras=IL 10
- pixel-live-20260617-090351__frame-232: esperado=TUN10 via confusão conhecida leituras=UIN 10
- pixel-live-20260617-090351__frame-237: esperado=TUN10 via confusão conhecida leituras=TIN 10
- pixel-live-20260617-090351__frame-254: esperado=MEX19 via confusão conhecida leituras=NEX 19
- pixel-live-20260617-090351__frame-258: esperado=ALG1 via confusão conhecida leituras=EG 1
- pixel-live-20260617-090351__frame-259: esperado=ALG1 via confusão conhecida leituras=MB 1
- pixel-live-20260617-090351__frame-262: esperado=QAT17 via confusão conhecida leituras=3AT 17
- pixel-live-20260617-090351__frame-264: esperado=QAT17 via confusão conhecida leituras=OAT 17
- pixel-live-20260617-090351__frame-266: esperado=QAT17 via confusão conhecida leituras=SOT 17
- pixel-live-20260617-090351__frame-267: esperado=QAT17 via confusão conhecida leituras=TOT 17
- pixel-live-20260617-090351__frame-271: esperado=QAT17 via confusão conhecida leituras=COT 17
- pixel-live-20260617-090351__frame-276: esperado=QAT17 via confusão conhecida leituras=SBT 17
- pixel-live-20260617-090351__frame-279: esperado=IRN10 via confusão conhecida leituras=SWJ 10
- pixel-live-20260617-090351__frame-280: esperado=IRN10 via confusão conhecida leituras=OWJ 10
- pixel-live-20260617-090351__frame-281: esperado=IRN10 via confusão conhecida leituras=MN 10
- pixel-live-20260617-090351__frame-282: esperado=IRN10 via confusão conhecida leituras=GN 10
- pixel-live-20260617-090351__frame-286: esperado=IRN15 via confusão conhecida leituras=ON 15
- pixel-live-20260617-090351__frame-287: esperado=IRN15 via confusão conhecida leituras=SVU 15
- pixel-live-20260617-090351__frame-288: esperado=IRN15 via confusão conhecida leituras=ON 15
- pixel-live-20260617-090351__frame-289: esperado=IRN15 via confusão conhecida leituras=ON 15
- pixel-live-20260617-090351__frame-293: esperado=IRN15 via confusão conhecida leituras=MN 15
- pixel-live-20260617-090351__frame-296: esperado=BIH12 via correção conservadora leituras=BH 12
- pixel-live-20260617-090351__frame-297: esperado=BIH12 via confusão conhecida leituras=IIBBFRH (0%) | DH 12
- pixel-live-20260617-090351__frame-299: esperado=BIH12 via confusão conhecida leituras=RH 12
- pixel-live-20260617-090351__frame-301: esperado=BIH12 via correção conservadora leituras=BH 12
- pixel-live-20260617-090351__frame-303: esperado=BIH12 via confusão conhecida leituras=SOU 12
- pixel-live-20260617-090351__frame-309: esperado=CUW4 via confusão conhecida leituras=OJW 4
- pixel-live-20260617-090351__frame-311: esperado=CUW4 via confusão conhecida leituras=OJW 4
- pixel-live-20260617-090351__frame-312: esperado=CUW4 via confusão conhecida leituras=DAY 4
- pixel-live-20260617-090351__frame-313: esperado=CUW4 via confusão conhecida leituras=OAV 4
- pixel-live-20260617-090351__frame-316: esperado=POR10 via confusão conhecida leituras=BN 10
- pixel-live-20260617-090351__frame-317: esperado=POR10 via confusão conhecida leituras=TXN 10
- pixel-live-20260617-090351__frame-322: esperado=IRQ20 via confusão conhecida leituras=IWJ 20
- pixel-live-20260617-090351__frame-327: esperado=IRQ20 via confusão conhecida leituras=SE 20
- pixel-live-20260617-090351__frame-329: esperado=IRQ20 via confusão conhecida leituras=SXJ 20

## Leituras não resolvidas por razão
### BOXES_NO_INK (60)
- live-setup-20260616-201017__frame-1: boxes=1 crops=0 reads=-
- live-user-20260616-201108__frame-5: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-7: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-11: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-16: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-17: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-18: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-20: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-28: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-33: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-37: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-42: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-43: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-44: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-45: boxes=2 crops=0 reads=-
- live-user-20260616-201108__frame-53: boxes=1 crops=0 reads=-
- ... e mais 44 itens
### NO_MATCH (172)
- live-user-20260616-201108__frame-4: boxes=2 crops=2 reads=MTF (0%) | NK X (0%)
- live-user-20260616-201108__frame-6: boxes=2 crops=2 reads=N XX (0%) | XXX (0%)
- live-user-20260616-201108__frame-8: boxes=2 crops=2 reads=IMB XXX (0%) | PUW XX (0%)
- live-user-20260616-201108__frame-9: boxes=4 crops=3 reads=dark:OENINF (0%) | dark:WONW X (0%)
- live-user-20260616-201108__frame-10: boxes=2 crops=2 reads=EIA X (0%) | MWE X (0%)
- live-user-20260616-201108__frame-12: boxes=2 crops=2 reads=RE (0%) | EE (0%)
- live-user-20260616-201108__frame-13: boxes=2 crops=2 reads=RE X (0%) | EE X (0%)
- live-user-20260616-201108__frame-14: boxes=2 crops=2 reads=EE X (0%) | NP X (0%)
- live-user-20260616-201108__frame-15: boxes=2 crops=2 reads=NF (0%) | FE (0%)
- live-user-20260616-201108__frame-19: boxes=2 crops=2 reads=W X (0%) | OR (0%)
- live-user-20260616-201108__frame-21: boxes=2 crops=2 reads=XX (0%) | W X (0%)
- live-user-20260616-201108__frame-22: boxes=2 crops=2 reads=NFE X (0%) | MET X (0%)
- live-user-20260616-201108__frame-23: boxes=4 crops=2 reads=dark:NNNBN (0%) | dark:NOMFMN (0%)
- live-user-20260616-201108__frame-24: boxes=2 crops=2 reads=FE (0%) | VN (0%)
- live-user-20260616-201108__frame-25: boxes=2 crops=2 reads=IEEBEE (0%) | EVWWENE (0%)
- live-user-20260616-201108__frame-26: boxes=2 crops=1 reads=-
- ... e mais 156 itens
### NO_BOXES (1)
- pixel-live-20260617-090351__frame-85: boxes=0 crops=0 reads=-

## Piores latências
1. live-user-20260616-201108__frame-9 det=26ms ocr=58ms boxes=4/1 crops=3 respostas=-
2. live-setup-20260616-201017__frame-3 det=36ms ocr=45ms boxes=4/1 crops=2 respostas=NED12
3. live-user-20260616-201108__frame-5 det=24ms ocr=37ms boxes=2/0 crops=0 respostas=-
4. live-user-20260616-201108__frame-7 det=22ms ocr=35ms boxes=2/0 crops=0 respostas=-
5. live-setup-20260616-201017__frame-4 det=29ms ocr=24ms boxes=2/1 crops=1 respostas=SWE8
6. live-setup-20260616-201017__frame-5 det=23ms ocr=30ms boxes=2/1 crops=1 respostas=SWE8
7. live-user-20260616-201108__frame-4 det=28ms ocr=24ms boxes=2/1 crops=2 respostas=-
8. live-user-20260616-201108__frame-23 det=13ms ocr=36ms boxes=4/0 crops=2 respostas=-
9. live-user-full-20260616-201728__frame-362 det=17ms ocr=30ms boxes=3/0 crops=0 respostas=-
10. pixel-live-20260617-090351__frame-155 det=13ms ocr=34ms boxes=2/0 crops=4 respostas=-
11. pixel-live-20260617-090351__frame-318 det=15ms ocr=32ms boxes=3/1 crops=4 respostas=-
12. live-user-20260616-201108__frame-11 det=23ms ocr=23ms boxes=2/0 crops=0 respostas=-

## Maior trabalho OCR
1. live-user-20260617-011113__frame-32 crops=6 boxes=3/0 respostas=- leituras=EGV 5 | EGV 5 | EG XX (0%) | EG XX (0%) | OBM X (0%) | EEN X (0%)
2. pixel-live-20260617-090351__frame-122 crops=6 boxes=2/2 respostas=- leituras=BI (0%) | IUM 1 | TW (0%) | TBII
3. pixel-live-20260617-090351__frame-304 crops=5 boxes=2/2 respostas=- leituras=SO XXX (0%) | SO XXX (0%) | BIE XX (0%) | BIM XX (0%)
4. pixel-live-20260617-090351__frame-307 crops=5 boxes=2/2 respostas=- leituras=DXW 4 | DXW 4 | EYIG | EW XX (0%)
5. pixel-live-20260617-090351__frame-75 crops=4 boxes=4/1 respostas=- leituras=dark:PB X (0%) | dark:X XX (0%)
6. pixel-live-20260617-090351__frame-155 crops=4 boxes=2/0 respostas=- leituras=MN 8 | NN 8 | BE X (0%) | EO X (0%)
7. pixel-live-20260617-090351__frame-157 crops=4 boxes=2/1 respostas=- leituras=M XX (0%) | M XX (0%) | EE X (0%) | EE X (0%)
8. pixel-live-20260617-090351__frame-172 crops=4 boxes=2/1 respostas=- leituras=NGA 8 | RBA 8 | XXXX (0%) | XXXX (0%)
9. pixel-live-20260617-090351__frame-190 crops=4 boxes=2/1 respostas=- leituras=12 | 12 | ZT | ZT
10. pixel-live-20260617-090351__frame-193 crops=4 boxes=2/1 respostas=- leituras=RSA XX (0%) | FGA XX (0%) | BIVR | XXXXX (0%)
11. pixel-live-20260617-090351__frame-204 crops=4 boxes=2/1 respostas=- leituras=OI | OI
12. pixel-live-20260617-090351__frame-226 crops=4 boxes=4/1 respostas=- leituras=dark:NTF XX (0%) | dark:OT XXX (0%)

## Falsos positivos
- sem falsos positivos
## Split
- treino: 293
- validação: 32
- teste: 48
- total com resultado: 373
- train -> tp=112 miss=58 fp=0
- val -> tp=14 miss=8 fp=0
- test -> tp=14 miss=10 fp=0
- unresolved: 76
- sem leitura mas com ocr: 51
- sem leitura e sem ocr: 25

## Diagnóstico dos positivos não resolvidos
### live-user-20260617-011113__frame-32 esperado=EGY5
- box=0 x=102.9 y=246.7 w=26.7 h=12.4 score=0.792 tilt=- crop=0 ink=false read=I X/0.0 glyphs=x=226 4x19 ar=4.75 holes=0 best=I:0.85 L=I:0.85 D=1:0.63 D2=0.48 | x=269 12x15 ar=1.25 holes=0 best=8:0.87 L=R:0.82 D=8:0.87 D2=0.84
- box=0 x=102.9 y=246.7 w=26.7 h=12.4 score=0.792 tilt=- crop=1 ink=false read=OI/85.0 glyphs=x=99 12x15 ar=1.25 holes=0 best=0:0.85 L=W:0.85 D=0:0.85 D2=0.85 | x=150 4x19 ar=4.75 holes=0 best=I:0.85 L=I:0.85 D=1:0.62 D2=0.48
- box=1 x=295.8 y=324.0 w=8.9 h=26.7 score=0.684 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=295.8 y=324.0 w=8.9 h=26.7 score=0.684 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=295.8 y=261.8 w=16.0 h=62.2 score=0.656 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=295.8 y=261.8 w=16.0 h=62.2 score=0.656 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=131.3 y=250.2 w=50.7 h=16.9 score=0.503 tilt=- crop=0 ink=true read=OBM X/0.0 glyphs=x=26 9x9 ar=1.00 holes=0 best=0:0.53 L=N:0.49 D=0:0.53 D2=0.50 | x=159 8x6 ar=0.75 holes=0 best=8:0.42 L=W:0.42 D=8:0.42 D2=0.41 | x=179 6x4 ar=0.67 holes=0 best=M:0.29 L=M:0.29 D=0:0.27 D2=0.26 | x=227 9x5 ar=0.56 holes=0 best=N:0.43 L=N:0.43 D=0:0.40 D2=0.38
- box=3 x=131.3 y=250.2 w=50.7 h=16.9 score=0.503 tilt=- crop=1 ink=true read=EEN X/0.0 glyphs=x=84 9x5 ar=0.56 holes=0 best=E:0.45 L=E:0.45 D=0:0.38 D2=0.37 | x=135 6x4 ar=0.67 holes=0 best=E:0.28 L=E:0.28 D=0:0.24 D2=0.23 | x=153 8x6 ar=0.75 holes=0 best=N:0.46 L=N:0.46 D=8:0.43 D2=0.43 | x=285 9x9 ar=1.00 holes=0 best=E:0.50 L=E:0.50 D=0:0.49 D2=0.49
### pixel-live-20260617-090351__frame-28 esperado=RSA13
- box=0 x=86.0 y=277.8 w=26.7 h=11.6 score=0.846 tilt=-0.9 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=277.8 w=26.7 h=11.6 score=0.846 tilt=-0.9 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=198.9 y=287.6 w=75.6 h=24.0 score=0.802 tilt=0.3 crop=0 ink=true read=RSA XX/0.0 glyphs=x=100 22x32 ar=1.45 holes=1 best=R:0.88 L=R:0.88 D=8:0.85 D2=0.83 | x=123 24x33 ar=1.38 holes=0 best=S:0.88 L=S:0.88 D=5:0.88 D2=0.86 | x=147 25x33 ar=1.32 holes=1 best=A:0.95 L=A:0.95 D=5:0.80 D2=0.80 | x=185 22x35 ar=1.59 holes=0 best=1:0.98 L=G:0.88 D=1:0.98 D2=0.81 | x=207 29x33 ar=1.14 holes=0 best=5:0.86 L=J:0.81 D=5:0.86 D2=0.84
- box=1 x=198.9 y=287.6 w=75.6 h=24.0 score=0.802 tilt=0.3 crop=1 ink=true read=ET XXX/0.0 glyphs=x=96 28x33 ar=1.18 holes=0 best=E:0.83 L=E:0.83 D=2:0.79 D2=0.77 | x=124 23x35 ar=1.52 holes=0 best=T:0.91 L=T:0.91 D=1:0.90 D2=0.79 | x=160 23x33 ar=1.43 holes=1 best=4:0.95 L=V:0.92 D=4:0.95 D2=0.79 | x=183 26x33 ar=1.27 holes=0 best=S:0.83 L=S:0.83 D=8:0.81 D2=0.80 | x=210 22x32 ar=1.45 holes=1 best=8:0.87 L=U:0.87 D=8:0.87 D2=0.82
- box=2 x=247.8 y=332.0 w=26.7 h=10.7 score=0.799 tilt=3.0 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=247.8 y=332.0 w=26.7 h=10.7 score=0.799 tilt=3.0 crop=1 ink=false read=/0.0 glyphs=
- box=3 x=349.1 y=291.1 w=45.3 h=16.9 score=0.692 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=349.1 y=291.1 w=45.3 h=16.9 score=0.692 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=267.1 w=27.6 h=10.7 score=0.691 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=267.1 w=27.6 h=10.7 score=0.691 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=198.9 y=332.9 w=46.2 h=9.8 score=0.482 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=198.9 y=332.9 w=46.2 h=9.8 score=0.482 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=213.1 y=345.3 w=46.2 h=9.8 score=0.443 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=213.1 y=345.3 w=46.2 h=9.8 score=0.443 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-29 esperado=RSA13
- box=0 x=252.2 y=332.9 w=25.8 h=9.8 score=0.805 tilt=2.8 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=252.2 y=332.9 w=25.8 h=9.8 score=0.805 tilt=2.8 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=202.4 y=287.6 w=76.4 h=24.0 score=0.798 tilt=0.1 crop=0 ink=true read=RSA XX/0.0 glyphs=x=102 23x32 ar=1.39 holes=1 best=R:0.86 L=R:0.86 D=8:0.83 D2=0.80 | x=125 23x34 ar=1.48 holes=0 best=S:0.91 L=S:0.91 D=8:0.85 D2=0.83 | x=148 26x33 ar=1.27 holes=1 best=A:0.93 L=A:0.93 D=4:0.77 D2=0.76 | x=187 22x35 ar=1.59 holes=0 best=1:0.99 L=I:0.88 D=1:0.99 D2=0.83 | x=209 30x34 ar=1.13 holes=0 best=5:0.84 L=J:0.83 D=5:0.84 D2=0.84
- box=1 x=202.4 y=287.6 w=76.4 h=24.0 score=0.798 tilt=0.1 crop=1 ink=true read=ETVS 8/87.2 glyphs=x=96 29x34 ar=1.17 holes=0 best=E:0.84 L=E:0.84 D=2:0.80 D2=0.78 | x=125 23x35 ar=1.52 holes=0 best=T:0.92 L=T:0.92 D=1:0.91 D2=0.80 | x=161 25x33 ar=1.32 holes=1 best=V:0.90 L=V:0.90 D=4:0.88 D2=0.77 | x=186 23x34 ar=1.48 holes=0 best=S:0.85 L=S:0.85 D=5:0.84 D2=0.82 | x=209 24x32 ar=1.33 holes=1 best=8:0.85 L=M:0.82 D=8:0.85 D2=0.78
- box=2 x=86.0 y=324.0 w=22.2 h=47.1 score=0.757 tilt=88.5 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=324.0 w=22.2 h=47.1 score=0.757 tilt=88.5 crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=277.8 w=26.7 h=10.7 score=0.747 tilt=5.0 crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=277.8 w=26.7 h=10.7 score=0.747 tilt=5.0 crop=1 ink=false read=/0.0 glyphs=
- box=4 x=349.1 y=291.1 w=45.3 h=16.0 score=0.703 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=349.1 y=291.1 w=45.3 h=16.0 score=0.703 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=202.4 y=332.9 w=47.1 h=10.7 score=0.479 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=202.4 y=332.9 w=47.1 h=10.7 score=0.479 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=216.7 y=345.3 w=46.2 h=9.8 score=0.437 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=216.7 y=345.3 w=46.2 h=9.8 score=0.437 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-33 esperado=RSA13
- box=0 x=189.1 y=284.0 w=75.6 h=24.0 score=0.801 tilt=0.9 crop=0 ink=true read=RSA XX/0.0 glyphs=x=102 22x30 ar=1.36 holes=1 best=R:0.87 L=R:0.87 D=8:0.83 D2=0.82 | x=124 24x34 ar=1.42 holes=0 best=S:0.90 L=S:0.90 D=8:0.86 D2=0.85 | x=148 24x32 ar=1.33 holes=1 best=A:0.92 L=A:0.92 D=4:0.75 D2=0.74 | x=186 21x34 ar=1.62 holes=0 best=1:0.99 L=G:0.86 D=1:0.99 D2=0.82 | x=207 28x33 ar=1.18 holes=0 best=3:0.86 L=J:0.81 D=3:0.86 D2=0.86
- box=0 x=189.1 y=284.0 w=75.6 h=24.0 score=0.801 tilt=0.9 crop=1 ink=true read=EIVS 8/87.6 glyphs=x=97 26x33 ar=1.27 holes=0 best=E:0.84 L=E:0.84 D=2:0.80 D2=0.79 | x=123 23x34 ar=1.48 holes=0 best=1:0.91 L=T:0.89 D=1:0.91 D2=0.79 | x=160 23x32 ar=1.39 holes=1 best=V:0.92 L=V:0.92 D=4:0.92 D2=0.76 | x=183 24x34 ar=1.42 holes=0 best=S:0.84 L=S:0.84 D=9:0.84 D2=0.83 | x=207 23x30 ar=1.30 holes=1 best=8:0.87 L=U:0.85 D=8:0.87 D2=0.82
- box=1 x=86.0 y=274.2 w=34.7 h=12.4 score=0.792 tilt=1.1 crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=274.2 w=34.7 h=12.4 score=0.792 tilt=1.1 crop=1 ink=false read=/0.0 glyphs=
- box=2 x=238.0 y=328.4 w=25.8 h=9.8 score=0.778 tilt=3.1 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=238.0 y=328.4 w=25.8 h=9.8 score=0.778 tilt=3.1 crop=1 ink=false read=/0.0 glyphs=
- box=3 x=349.1 y=291.1 w=45.3 h=16.9 score=0.703 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=349.1 y=291.1 w=45.3 h=16.9 score=0.703 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=263.6 w=27.6 h=10.7 score=0.686 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=263.6 w=27.6 h=10.7 score=0.686 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=190.0 y=329.3 w=45.3 h=8.9 score=0.460 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=190.0 y=329.3 w=45.3 h=8.9 score=0.460 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=203.3 y=340.0 w=46.2 h=10.7 score=0.458 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=203.3 y=340.0 w=46.2 h=10.7 score=0.458 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-35 esperado=RSA13
- box=0 x=243.3 y=325.8 w=25.8 h=9.8 score=0.785 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=243.3 y=325.8 w=25.8 h=9.8 score=0.785 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=194.4 y=281.3 w=75.6 h=23.1 score=0.777 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=194.4 y=281.3 w=75.6 h=23.1 score=0.777 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=260.0 w=26.7 h=10.7 score=0.674 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=260.0 w=26.7 h=10.7 score=0.674 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=194.4 y=325.8 w=46.2 h=9.8 score=0.474 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=194.4 y=325.8 w=46.2 h=9.8 score=0.474 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=208.7 y=338.2 w=46.2 h=9.8 score=0.425 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=208.7 y=338.2 w=46.2 h=9.8 score=0.425 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-72 esperado=MEX15
- box=0 x=86.0 y=318.7 w=136.0 h=52.4 score=0.797 tilt=-5.8 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=318.7 w=136.0 h=52.4 score=0.797 tilt=-5.8 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=141.1 y=333.8 w=67.6 h=20.4 score=0.735 tilt=-0.6 crop=0 ink=true read=ME 115/90.5 glyphs=x=103 12x20 ar=1.67 holes=0 best=M:0.91 L=M:0.91 D=8:0.89 D2=0.87 | x=115 34x33 ar=0.97 holes=0 best=E:0.89 L=E:0.89 D=0:0.85 D2=0.81 | x=166 14x27 ar=1.93 holes=0 best=1:0.82 L=M:0.80 D=1:0.82 D2=0.69 | x=202 18x35 ar=1.94 holes=0 best=1:0.95 L=I:0.87 D=1:0.95 D2=0.83 | x=226 29x38 ar=1.31 holes=1 best=5:0.95 L=B:0.91 D=5:0.95 D2=0.94
- box=1 x=141.1 y=333.8 w=67.6 h=20.4 score=0.735 tilt=-0.6 crop=1 ink=true read=EI XXX/0.0 glyphs=x=92 29x38 ar=1.31 holes=1 best=E:0.93 L=E:0.93 D=9:0.92 D2=0.91 | x=127 18x35 ar=1.94 holes=0 best=1:0.89 L=T:0.87 D=1:0.89 D2=0.76 | x=167 14x27 ar=1.93 holes=0 best=1:0.84 L=M:0.81 D=1:0.84 D2=0.67 | x=198 34x33 ar=0.97 holes=0 best=8:0.82 L=E:0.82 D=8:0.82 D2=0.78 | x=232 12x20 ar=1.67 holes=0 best=8:0.90 L=W:0.86 D=8:0.90 D2=0.87
- box=2 x=349.1 y=291.1 w=45.3 h=17.8 score=0.656 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=349.1 y=291.1 w=45.3 h=17.8 score=0.656 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-75 esperado=MEX15
- box=0 x=284.2 y=304.4 w=16.0 h=48.9 score=0.750 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=284.2 y=304.4 w=16.0 h=48.9 score=0.750 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=146.4 y=283.1 w=21.3 h=8.9 score=0.718 tilt=- crop=0 ink=true read=/0.0 glyphs=x=109 44x39 ar=0.89 holes=0 best=0:0.92 L=W:0.89 D=0:0.92 D2=0.90
- box=1 x=146.4 y=283.1 w=21.3 h=8.9 score=0.718 tilt=- crop=1 ink=true read=/0.0 glyphs=x=248 44x39 ar=0.89 holes=0 best=8:0.91 L=W:0.87 D=8:0.91 D2=0.90
- box=2 x=86.0 y=284.9 w=20.4 h=8.0 score=0.693 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=284.9 w=20.4 h=8.0 score=0.693 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=128.7 y=297.3 w=153.8 h=73.8 score=0.457 tilt=8.2 crop=0 ink=false read=IM/0.0 glyphs=x=195 7x10 ar=1.43 holes=0 best=1:0.59 L=I:0.56 D=1:0.59 D2=0.51 | x=202 11x8 ar=0.73 holes=0 best=M:0.50 L=M:0.50 D=0:0.44 D2=0.42
- box=3 x=128.7 y=297.3 w=153.8 h=73.8 score=0.457 tilt=8.2 crop=1 ink=false read=DT/0.0 glyphs=x=44 10x8 ar=0.80 holes=0 best=D:0.46 L=D:0.46 D=0:0.42 D2=0.37 | x=54 8x10 ar=1.25 holes=0 best=T:0.58 L=T:0.58 D=7:0.53 D2=0.50
- box=4 x=108.2 y=284.0 w=36.4 h=8.0 score=0.445 tilt=- crop=0 ink=true read=BF/0.0 glyphs=x=179 18x23 ar=1.28 holes=0 best=8:0.89 L=W:0.86 D=8:0.89 D2=0.86 | x=360 5x10 ar=2.00 holes=0 best=F:0.55 L=F:0.55 D=8:0.46 D2=0.44
- box=4 x=108.2 y=284.0 w=36.4 h=8.0 score=0.445 tilt=- crop=1 ink=true read=XX/0.0 glyphs=x=103 5x10 ar=2.00 holes=0 best=1:0.55 L=J:0.52 D=1:0.55 D2=0.51 | x=271 18x23 ar=1.28 holes=0 best=8:0.89 L=W:0.87 D=8:0.89 D2=0.87
### pixel-live-20260617-090351__frame-76 esperado=MEX15
- box=0 x=87.8 y=291.1 w=19.6 h=8.0 score=0.864 tilt=-0.3 crop=0 ink=false read=/0.0 glyphs=x=256 21x21 ar=1.00 holes=0 best=E:0.81 L=E:0.81 D=8:0.75 D2=0.75
- box=0 x=87.8 y=291.1 w=19.6 h=8.0 score=0.864 tilt=-0.3 crop=1 ink=false read=/0.0 glyphs=x=148 21x21 ar=1.00 holes=0 best=4:0.83 L=E:0.79 D=4:0.83 D2=0.79
- box=1 x=283.3 y=310.7 w=15.1 h=48.9 score=0.754 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=283.3 y=310.7 w=15.1 h=48.9 score=0.754 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=147.3 y=289.3 w=21.3 h=8.9 score=0.754 tilt=- crop=0 ink=true read=/0.0 glyphs=x=107 44x54 ar=1.23 holes=0 best=W:0.89 L=W:0.89 D=0:0.86 D2=0.84
- box=2 x=147.3 y=289.3 w=21.3 h=8.9 score=0.754 tilt=- crop=1 ink=true read=/0.0 glyphs=x=250 44x54 ar=1.23 holes=0 best=8:0.87 L=W:0.85 D=8:0.87 D2=0.83
- box=3 x=349.1 y=291.1 w=45.3 h=17.8 score=0.679 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=349.1 y=291.1 w=45.3 h=17.8 score=0.679 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=216.7 y=300.0 w=70.2 h=19.6 score=0.568 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=216.7 y=300.0 w=70.2 h=19.6 score=0.568 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=129.6 y=303.6 w=152.9 h=67.6 score=0.507 tilt=- crop=0 ink=false read=/0.0 glyphs=x=67 3x3 ar=1.00 holes=0 best=R:0.22 L=R:0.22 D=4:0.21 D2=0.20
- box=5 x=129.6 y=303.6 w=152.9 h=67.6 score=0.507 tilt=- crop=1 ink=false read=/0.0 glyphs=x=179 3x3 ar=1.00 holes=0 best=R:0.22 L=R:0.22 D=4:0.21 D2=0.20
- box=6 x=311.8 y=341.8 w=8.0 h=29.3 score=0.493 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=311.8 y=341.8 w=8.0 h=29.3 score=0.493 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-77 esperado=MEX15
- box=0 x=283.3 y=305.3 w=19.6 h=42.7 score=0.725 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=283.3 y=305.3 w=19.6 h=42.7 score=0.725 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=350.0 y=291.1 w=44.4 h=17.8 score=0.672 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=350.0 y=291.1 w=44.4 h=17.8 score=0.672 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=129.6 y=291.1 w=29.3 h=8.9 score=0.513 tilt=- crop=0 ink=false read=/0.0 glyphs=x=125 9x14 ar=1.56 holes=0 best=N:0.80 L=N:0.80 D=4:0.76 D2=0.73
- box=2 x=129.6 y=291.1 w=29.3 h=8.9 score=0.513 tilt=- crop=1 ink=false read=/0.0 glyphs=x=193 9x14 ar=1.56 holes=0 best=N:0.80 L=N:0.80 D=1:0.71 D2=0.70
- box=3 x=222.9 y=299.1 w=71.1 h=16.0 score=0.500 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=222.9 y=299.1 w=71.1 h=16.0 score=0.500 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=140.2 y=300.9 w=146.7 h=70.2 score=0.474 tilt=10.5 crop=0 ink=false read=I X/0.0 glyphs=x=197 8x9 ar=1.13 holes=0 best=I:0.56 L=I:0.56 D=4:0.54 D2=0.52 | x=205 11x9 ar=0.82 holes=0 best=0:0.57 L=O:0.54 D=0:0.57 D2=0.55
- box=4 x=140.2 y=300.9 w=146.7 h=70.2 score=0.474 tilt=10.5 crop=1 ink=false read=DT/0.0 glyphs=x=45 10x9 ar=0.90 holes=0 best=D:0.54 L=D:0.54 D=0:0.50 D2=0.47 | x=55 9x9 ar=1.00 holes=0 best=T:0.55 L=T:0.55 D=7:0.50 D2=0.48
- box=5 x=86.0 y=262.7 w=27.6 h=108.4 score=0.248 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=262.7 w=27.6 h=108.4 score=0.248 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-78 esperado=MEX15
- box=0 x=274.4 y=301.8 w=22.2 h=44.4 score=0.695 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=274.4 y=301.8 w=22.2 h=44.4 score=0.695 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=349.1 y=291.1 w=45.3 h=17.8 score=0.683 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=349.1 y=291.1 w=45.3 h=17.8 score=0.683 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-85 esperado=MEX15
- sem diagnóstico
### pixel-live-20260617-090351__frame-86 esperado=MEX15
- box=0 x=271.8 y=292.0 w=24.9 h=79.1 score=0.732 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=271.8 y=292.0 w=24.9 h=79.1 score=0.732 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=243.1 w=29.3 h=10.7 score=0.637 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=243.1 w=29.3 h=10.7 score=0.637 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=116.2 y=289.3 w=161.8 h=81.8 score=0.433 tilt=9.9 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=116.2 y=289.3 w=161.8 h=81.8 score=0.433 tilt=9.9 crop=1 ink=false read=/0.0 glyphs=
- box=3 x=350.0 y=291.1 w=44.4 h=10.7 score=0.402 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=350.0 y=291.1 w=44.4 h=10.7 score=0.402 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=280.4 w=40.0 h=9.8 score=0.380 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=280.4 w=40.0 h=9.8 score=0.380 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=156.2 y=276.0 w=41.8 h=10.7 score=0.369 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=156.2 y=276.0 w=41.8 h=10.7 score=0.369 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-106 esperado=GHA19
- box=0 x=198.9 y=315.1 w=67.6 h=18.7 score=0.754 tilt=- crop=0 ink=true read=GDUA 10/88.3 glyphs=x=170 44x47 ar=1.07 holes=0 best=G:0.88 L=G:0.88 D=0:0.74 D2=0.73 | x=200 40x48 ar=1.20 holes=0 best=D:0.84 L=D:0.84 D=8:0.82 D2=0.82 | x=240 25x47 ar=1.88 holes=0 best=4:0.84 L=U:0.79 D=4:0.84 D2=0.81 | x=265 51x51 ar=1.00 holes=1 best=A:0.91 L=A:0.91 D=5:0.82 D2=0.81 | x=342 42x52 ar=1.24 holes=0 best=1:0.93 L=M:0.86 D=1:0.93 D2=0.84 | x=384 57x53 ar=0.93 holes=2 best=0:0.94 L=E:0.88 D=0:0.94 D2=0.93
- box=0 x=198.9 y=315.1 w=67.6 h=18.7 score=0.754 tilt=- crop=1 ink=true read=GIVMOU/87.0 glyphs=x=157 56x53 ar=0.95 holes=2 best=6:0.94 L=B:0.88 D=6:0.94 D2=0.94 | x=213 43x52 ar=1.21 holes=0 best=1:0.86 L=Y:0.84 D=1:0.86 D2=0.81 | x=282 50x51 ar=1.02 holes=1 best=V:0.87 L=V:0.87 D=4:0.87 D2=0.82 | x=332 25x47 ar=1.88 holes=0 best=M:0.85 L=M:0.85 D=1:0.83 D2=0.73 | x=357 41x48 ar=1.17 holes=0 best=0:0.83 L=W:0.81 D=0:0.83 D2=0.82 | x=384 44x47 ar=1.07 holes=0 best=U:0.88 L=U:0.88 D=0:0.77 D2=0.73
- box=1 x=134.0 y=349.8 w=76.4 h=21.3 score=0.737 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=134.0 y=349.8 w=76.4 h=21.3 score=0.737 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=134.0 y=326.7 w=20.4 h=7.1 score=0.699 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=134.0 y=326.7 w=20.4 h=7.1 score=0.699 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=350.9 y=292.0 w=43.6 h=17.8 score=0.689 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=350.9 y=292.0 w=43.6 h=17.8 score=0.689 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-117 esperado=GER4
- box=0 x=86.0 y=285.8 w=24.9 h=10.7 score=0.833 tilt=-0.9 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=285.8 w=24.9 h=10.7 score=0.833 tilt=-0.9 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=196.2 y=296.4 w=79.1 h=28.4 score=0.824 tilt=3.7 crop=0 ink=true read=TIIII 4/88.7 glyphs=x=156 15x44 ar=2.93 holes=0 best=T:0.84 L=T:0.84 D=1:0.69 D2=0.59 | x=179 11x23 ar=2.09 holes=0 best=1:0.87 L=N:0.86 D=1:0.87 D2=0.78 | x=195 13x47 ar=3.62 holes=0 best=I:0.92 L=I:0.92 D=1:0.79 D2=0.62 | x=226 13x45 ar=3.46 holes=0 best=I:0.86 L=I:0.86 D=1:0.73 D2=0.60 | x=244 13x42 ar=3.23 holes=0 best=I:0.88 L=I:0.88 D=1:0.76 D2=0.64 | x=282 41x48 ar=1.17 holes=0 best=4:0.95 L=M:0.83 D=4:0.95 D2=0.83
- box=1 x=196.2 y=296.4 w=79.1 h=28.4 score=0.824 tilt=3.7 crop=1 ink=true read=EIIINJ/90.7 glyphs=x=152 41x48 ar=1.17 holes=0 best=E:0.96 L=E:0.96 D=8:0.82 D2=0.79 | x=218 13x42 ar=3.23 holes=0 best=I:0.90 L=I:0.90 D=1:0.78 D2=0.60 | x=236 13x45 ar=3.46 holes=0 best=I:0.90 L=I:0.90 D=1:0.80 D2=0.63 | x=267 13x47 ar=3.62 holes=0 best=I:0.92 L=I:0.92 D=1:0.82 D2=0.66 | x=285 11x23 ar=2.09 holes=0 best=N:0.86 L=N:0.86 D=1:0.81 D2=0.77 | x=304 15x44 ar=2.93 holes=0 best=J:0.91 L=J:0.91 D=1:0.78 D2=0.72
- box=2 x=114.4 y=317.8 w=143.1 h=53.3 score=0.811 tilt=6.9 crop=0 ink=true read=/0.0 glyphs=x=21 10x8 ar=0.80 holes=0 best=E:0.55 L=E:0.55 D=0:0.50 D2=0.49 | x=31 9x10 ar=1.11 holes=1 best=0:0.58 L=O:0.58 D=0:0.58 D2=0.57 | x=40 9x10 ar=1.11 holes=0 best=W:0.59 L=W:0.59 D=0:0.58 D2=0.57 | x=50 5x9 ar=1.80 holes=0 best=E:0.50 L=E:0.50 D=1:0.50 D2=0.49 | x=55 11x10 ar=0.91 holes=0 best=0:0.64 L=N:0.62 D=0:0.64 D2=0.60 | x=69 6x11 ar=1.83 holes=0 best=6:0.64 L=C:0.62 D=6:0.64 D2=0.62 | x=75 7x11 ar=1.57 holes=0 best=8:0.63 L=B:0.63 D=8:0.63 D2=0.62 | x=82 13x13 ar=1.00 holes=0 best=E:0.73 L=E:0.73 D=0:0.72 D2=0.70 | x=98 10x12 ar=1.20 holes=0 best=8:0.76 L=E:0.72 D=8:0.76 D2=0.72 | x=108 7x12 ar=1.71 holes=0 best=8:0.67 L=S:0.65 D=8:0.67 D2=0.64 | x=115 7x11 ar=1.57 holes=0 best=B:0.64 L=B:0.64 D=8:0.64 D2=0.62 | x=122 10x11 ar=1.10 holes=0 best=8:0.67 L=W:0.65 D=8:0.67 D2=0.66 | x=132 14x11 ar=0.79 holes=0 best=0:0.78 L=E:0.75 D=0:0.78 D2=0.76
- box=2 x=114.4 y=317.8 w=143.1 h=53.3 score=0.811 tilt=6.9 crop=1 ink=true read=/0.0 glyphs=x=142 11x11 ar=1.00 holes=0 best=0:0.66 L=M:0.63 D=0:0.66 D2=0.63 | x=153 12x11 ar=0.92 holes=0 best=0:0.70 L=R:0.68 D=0:0.70 D2=0.67 | x=165 7x11 ar=1.57 holes=0 best=B:0.64 L=B:0.64 D=8:0.64 D2=0.63 | x=172 7x12 ar=1.71 holes=0 best=8:0.68 L=S:0.65 D=8:0.68 D2=0.65 | x=179 11x12 ar=1.09 holes=0 best=0:0.69 L=B:0.67 D=0:0.69 D2=0.67 | x=193 9x12 ar=1.33 holes=0 best=W:0.67 L=W:0.67 D=8:0.67 D2=0.65 | x=202 10x11 ar=1.10 holes=0 best=8:0.65 L=W:0.65 D=8:0.65 D2=0.64 | x=212 7x11 ar=1.57 holes=0 best=8:0.61 L=B:0.59 D=8:0.61 D2=0.58 | x=222 10x10 ar=1.00 holes=0 best=8:0.57 L=E:0.55 D=8:0.57 D2=0.56 | x=232 6x9 ar=1.50 holes=0 best=T:0.57 L=T:0.57 D=1:0.55 D2=0.52 | x=239 8x10 ar=1.25 holes=0 best=8:0.59 L=W:0.56 D=8:0.59 D2=0.56 | x=247 9x10 ar=1.11 holes=1 best=0:0.58 L=U:0.57 D=0:0.58 D2=0.57 | x=256 11x8 ar=0.73 holes=0 best=E:0.55 L=E:0.55 D=0:0.53 D2=0.51
- box=3 x=128.7 y=348.0 w=78.2 h=23.1 score=0.708 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=128.7 y=348.0 w=78.2 h=23.1 score=0.708 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=271.8 y=328.4 w=8.0 h=36.4 score=0.445 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=271.8 y=328.4 w=8.0 h=36.4 score=0.445 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-122 esperado=PAN1
- box=0 x=256.7 y=250.2 w=28.4 h=12.4 score=0.910 tilt=-4.0 crop=0 ink=true read=BI/0.0 glyphs=x=95 23x31 ar=1.35 holes=0 best=8:0.90 L=W:0.87 D=8:0.90 D2=0.87 | x=188 4x12 ar=3.00 holes=0 best=I:0.59 L=I:0.59 D=1:0.54 D2=0.47
- box=0 x=256.7 y=250.2 w=28.4 h=12.4 score=0.910 tilt=-4.0 crop=1 ink=true read=TW/0.0 glyphs=x=207 4x12 ar=3.00 holes=0 best=T:0.57 L=T:0.57 D=1:0.53 D2=0.48 | x=281 23x31 ar=1.35 holes=0 best=W:0.89 L=W:0.89 D=8:0.88 D2=0.87
- box=1 x=233.6 y=224.4 w=107.6 h=46.2 score=0.853 tilt=9.4 crop=0 ink=true read=IUM 1/84.9 glyphs=x=164 13x37 ar=2.85 holes=0 best=I:0.80 L=I:0.80 D=1:0.72 D2=0.62 | x=205 15x38 ar=2.53 holes=0 best=U:0.81 L=U:0.81 D=1:0.77 D2=0.70 | x=244 10x17 ar=1.70 holes=0 best=M:0.84 L=M:0.84 D=8:0.84 D2=0.83 | x=280 22x44 ar=2.00 holes=0 best=1:0.94 L=J:0.86 D=1:0.94 D2=0.84
- box=1 x=233.6 y=224.4 w=107.6 h=46.2 score=0.853 tilt=9.4 crop=1 ink=true read=TBII/83.2 glyphs=x=239 22x44 ar=2.00 holes=0 best=T:0.88 L=T:0.88 D=1:0.81 D2=0.73 | x=287 10x17 ar=1.70 holes=0 best=8:0.87 L=M:0.86 D=8:0.87 D2=0.85 | x=321 15x38 ar=2.53 holes=0 best=I:0.77 L=I:0.77 D=1:0.74 D2=0.60 | x=364 13x37 ar=2.85 holes=0 best=I:0.81 L=I:0.81 D=1:0.75 D2=0.63
- box=2 x=152.7 y=252.0 w=24.0 h=8.9 score=0.784 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=152.7 y=252.0 w=24.0 h=8.9 score=0.784 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=253.8 w=20.4 h=8.9 score=0.672 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=253.8 w=20.4 h=8.9 score=0.672 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=109.1 y=252.0 w=41.8 h=9.8 score=0.402 tilt=- crop=0 ink=false read=/0.0 glyphs=x=166 9x14 ar=1.56 holes=0 best=N:0.80 L=N:0.80 D=4:0.75 D2=0.73
- box=4 x=109.1 y=252.0 w=41.8 h=9.8 score=0.402 tilt=- crop=1 ink=false read=/0.0 glyphs=x=248 9x14 ar=1.56 holes=0 best=N:0.80 L=N:0.80 D=1:0.74 D2=0.73
- box=5 x=179.3 y=250.2 w=43.6 h=9.8 score=0.399 tilt=- crop=0 ink=true read=/0.0 glyphs=x=168 21x24 ar=1.14 holes=0 best=8:0.92 L=W:0.91 D=8:0.92 D2=0.90
- box=5 x=179.3 y=250.2 w=43.6 h=9.8 score=0.399 tilt=- crop=1 ink=true read=/0.0 glyphs=x=254 21x24 ar=1.14 holes=0 best=8:0.93 L=W:0.90 D=8:0.93 D2=0.92
- box=6 x=247.8 y=269.8 w=69.3 h=14.2 score=0.344 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=247.8 y=269.8 w=69.3 h=14.2 score=0.344 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-123 esperado=PAN1
- box=0 x=300.2 y=294.7 w=23.1 h=76.4 score=0.805 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=300.2 y=294.7 w=23.1 h=76.4 score=0.805 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=158.0 y=267.1 w=22.2 h=8.9 score=0.787 tilt=- crop=0 ink=true read=OI/87.4 glyphs=x=102 45x39 ar=0.87 holes=0 best=0:0.89 L=N:0.88 D=0:0.89 D2=0.86 | x=147 4x28 ar=7.00 holes=0 best=I:0.85 L=I:0.85 D=1:0.68 D2=0.52
- box=1 x=158.0 y=267.1 w=22.2 h=8.9 score=0.787 tilt=- crop=1 ink=true read=OI/85.9 glyphs=x=263 45x39 ar=0.87 holes=0 best=0:0.90 L=N:0.87 D=0:0.90 D2=0.88 | x=308 4x17 ar=4.25 holes=0 best=I:0.82 L=I:0.82 D=1:0.66 D2=0.50
- box=2 x=256.7 y=267.1 w=28.4 h=13.3 score=0.776 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=256.7 y=267.1 w=28.4 h=13.3 score=0.776 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=91.3 y=268.0 w=21.3 h=8.0 score=0.711 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=91.3 y=268.0 w=21.3 h=8.0 score=0.711 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=87.8 y=337.3 w=9.8 h=33.8 score=0.575 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=87.8 y=337.3 w=9.8 h=33.8 score=0.575 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=116.2 y=267.1 w=40.0 h=8.9 score=0.410 tilt=- crop=0 ink=true read=/0.0 glyphs=x=158 17x19 ar=1.12 holes=0 best=8:0.92 L=E:0.87 D=8:0.92 D2=0.89
- box=5 x=116.2 y=267.1 w=40.0 h=8.9 score=0.410 tilt=- crop=1 ink=true read=/0.0 glyphs=x=263 17x19 ar=1.12 holes=0 best=8:0.89 L=W:0.89 D=8:0.89 D2=0.88
- box=6 x=134.9 y=285.8 w=175.1 h=85.3 score=0.394 tilt=8.6 crop=0 ink=false read=/0.0 glyphs=x=28 8x19 ar=2.38 holes=0 best=N:0.73 L=N:0.73 D=1:0.68 D2=0.63
- box=6 x=134.9 y=285.8 w=175.1 h=85.3 score=0.394 tilt=8.6 crop=1 ink=false read=/0.0 glyphs=x=250 8x19 ar=2.38 holes=0 best=1:0.76 L=I:0.76 D=1:0.76 D2=0.65
- box=7 x=182.9 y=267.1 w=41.8 h=9.8 score=0.389 tilt=- crop=0 ink=true read=/0.0 glyphs=x=164 20x21 ar=1.05 holes=0 best=0:0.94 L=E:0.88 D=0:0.94 D2=0.94
- box=7 x=182.9 y=267.1 w=41.8 h=9.8 score=0.389 tilt=- crop=1 ink=true read=/0.0 glyphs=x=239 20x21 ar=1.05 holes=0 best=8:0.93 L=E:0.88 D=8:0.93 D2=0.93
### pixel-live-20260617-090351__frame-134 esperado=NOR20
- box=0 x=119.8 y=264.4 w=22.2 h=8.0 score=0.945 tilt=5.4 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=119.8 y=264.4 w=22.2 h=8.0 score=0.945 tilt=5.4 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=91.3 y=265.3 w=25.8 h=9.8 score=0.838 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=91.3 y=265.3 w=25.8 h=9.8 score=0.838 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=194.4 y=252.0 w=86.2 h=27.6 score=0.651 tilt=- crop=0 ink=true read=XXX/0.0 glyphs=x=95 8x10 ar=1.25 holes=0 best=8:0.60 L=E:0.57 D=8:0.60 D2=0.59 | x=108 4x7 ar=1.75 holes=0 best=1:0.43 L=Q:0.42 D=1:0.43 D2=0.42 | x=124 4x5 ar=1.25 holes=0 best=E:0.29 L=E:0.29 D=8:0.26 D2=0.24
- box=2 x=194.4 y=252.0 w=86.2 h=27.6 score=0.651 tilt=- crop=1 ink=true read=AR X/0.0 glyphs=x=202 4x5 ar=1.25 holes=0 best=4:0.35 L=A:0.30 D=4:0.35 D2=0.28 | x=218 4x7 ar=1.75 holes=0 best=R:0.41 L=R:0.41 D=8:0.37 D2=0.37 | x=227 8x10 ar=1.25 holes=0 best=8:0.57 L=P:0.57 D=8:0.57 D2=0.56
- box=3 x=100.2 y=288.4 w=24.0 h=82.7 score=0.479 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=100.2 y=288.4 w=24.0 h=82.7 score=0.479 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-137 esperado=NOR20
- box=0 x=206.0 y=249.3 w=108.4 h=48.9 score=0.741 tilt=11.8 crop=0 ink=true read=XX/0.0 glyphs=x=148 23x25 ar=1.09 holes=0 best=2:0.81 L=P:0.71 D=2:0.81 D2=0.77 | x=171 25x25 ar=1.00 holes=1 best=O:0.89 L=O:0.89 D=0:0.88 D2=0.85
- box=0 x=206.0 y=249.3 w=108.4 h=48.9 score=0.741 tilt=11.8 crop=1 ink=true read=XX/0.0 glyphs=x=135 25x25 ar=1.00 holes=1 best=0:0.89 L=O:0.88 D=0:0.89 D2=0.86 | x=160 23x25 ar=1.09 holes=0 best=2:0.77 L=B:0.72 D=2:0.77 D2=0.71
- box=1 x=227.3 y=298.2 w=48.9 h=18.7 score=0.708 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=227.3 y=298.2 w=48.9 h=18.7 score=0.708 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=94.0 y=264.4 w=104.0 h=28.4 score=0.615 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=94.0 y=264.4 w=104.0 h=28.4 score=0.615 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-145 esperado=CIV4
- box=0 x=220.2 y=305.3 w=78.2 h=41.8 score=0.778 tilt=11.6 crop=0 ink=true read=PW X/0.0 glyphs=x=148 25x32 ar=1.28 holes=0 best=P:0.69 L=P:0.69 D=0:0.59 D2=0.58 | x=174 39x38 ar=0.97 holes=0 best=W:0.77 L=W:0.77 D=8:0.66 D2=0.65 | x=227 29x37 ar=1.28 holes=0 best=4:0.94 L=A:0.79 D=4:0.94 D2=0.79
- box=0 x=220.2 y=305.3 w=78.2 h=41.8 score=0.778 tilt=11.6 crop=1 ink=true read=EOJ/0.0 glyphs=x=183 29x37 ar=1.28 holes=0 best=E:0.85 L=E:0.85 D=8:0.79 D2=0.78 | x=226 39x38 ar=0.97 holes=0 best=0:0.69 L=N:0.68 D=0:0.69 D2=0.67 | x=266 25x32 ar=1.28 holes=0 best=J:0.76 L=J:0.76 D=3:0.65 D2=0.63
- box=1 x=148.2 y=330.2 w=23.1 h=8.0 score=0.753 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=148.2 y=330.2 w=23.1 h=8.0 score=0.753 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=292.0 w=24.9 h=9.8 score=0.736 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=292.0 w=24.9 h=9.8 score=0.736 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=352.7 y=292.9 w=41.8 h=16.9 score=0.683 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=352.7 y=292.9 w=41.8 h=16.9 score=0.683 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=169.6 y=346.2 w=72.0 h=19.6 score=0.471 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=169.6 y=346.2 w=72.0 h=19.6 score=0.471 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=104.7 y=329.3 w=42.7 h=9.8 score=0.402 tilt=- crop=0 ink=true read=XX/0.0 glyphs=x=166 20x22 ar=1.10 holes=0 best=8:0.93 L=W:0.89 D=8:0.93 D2=0.91 | x=332 6x10 ar=1.67 holes=0 best=I:0.60 L=I:0.60 D=4:0.58 D2=0.53
- box=5 x=104.7 y=329.3 w=42.7 h=9.8 score=0.402 tilt=- crop=1 ink=true read=I X/0.0 glyphs=x=99 6x10 ar=1.67 holes=0 best=I:0.54 L=I:0.54 D=1:0.54 D2=0.50 | x=251 20x22 ar=1.10 holes=0 best=8:0.93 L=W:0.89 D=8:0.93 D2=0.91
### pixel-live-20260617-090351__frame-148 esperado=NZL18
- box=0 x=224.7 y=228.9 w=112.0 h=48.9 score=0.840 tilt=9.6 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=224.7 y=228.9 w=112.0 h=48.9 score=0.840 tilt=9.6 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=142.9 y=255.6 w=24.9 h=8.9 score=0.771 tilt=- crop=0 ink=true read=/0.0 glyphs=x=121 56x57 ar=1.02 holes=0 best=0:0.95 L=W:0.87 D=0:0.95 D2=0.93
- box=1 x=142.9 y=255.6 w=24.9 h=8.9 score=0.771 tilt=- crop=1 ink=true read=/0.0 glyphs=x=273 56x57 ar=1.02 holes=0 best=0:0.93 L=W:0.87 D=0:0.93 D2=0.92
- box=2 x=350.0 y=292.9 w=44.4 h=10.7 score=0.558 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=350.0 y=292.9 w=44.4 h=10.7 score=0.558 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=100.2 y=254.7 w=40.9 h=9.8 score=0.470 tilt=- crop=0 ink=true read=/0.0 glyphs=x=155 19x18 ar=0.95 holes=0 best=0:0.91 L=W:0.88 D=0:0.91 D2=0.91
- box=3 x=100.2 y=254.7 w=40.9 h=9.8 score=0.470 tilt=- crop=1 ink=true read=/0.0 glyphs=x=242 19x18 ar=0.95 holes=0 best=0:0.90 L=E:0.86 D=0:0.90 D2=0.90
### pixel-live-20260617-090351__frame-154 esperado=AUS6
- box=0 x=96.7 y=275.1 w=48.0 h=96.0 score=0.872 tilt=-85.5 crop=0 ink=false read=/0.0 glyphs=x=197 4x3 ar=0.75 holes=0 best=5:0.25 L=B:0.21 D=5:0.25 D2=0.23
- box=0 x=96.7 y=275.1 w=48.0 h=96.0 score=0.872 tilt=-85.5 crop=1 ink=false read=/0.0 glyphs=x=22 4x3 ar=0.75 holes=0 best=V:0.21 L=V:0.21 D=4:0.21 D2=0.21
- box=1 x=86.0 y=242.2 w=24.9 h=9.8 score=0.792 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=242.2 w=24.9 h=9.8 score=0.792 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=115.3 y=324.0 w=16.9 h=33.8 score=0.711 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=115.3 y=324.0 w=16.9 h=33.8 score=0.711 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=147.3 y=216.4 w=24.0 h=8.9 score=0.689 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=147.3 y=216.4 w=24.0 h=8.9 score=0.689 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=198.9 y=223.6 w=93.3 h=32.0 score=0.588 tilt=- crop=0 ink=true read=EB XX/0.0 glyphs=x=101 4x5 ar=1.25 holes=0 best=E:0.33 L=E:0.33 D=4:0.25 D2=0.25 | x=104 7x6 ar=0.86 holes=0 best=8:0.33 L=E:0.33 D=8:0.33 D2=0.33 | x=113 4x3 ar=0.75 holes=0 best=4:0.26 L=N:0.23 D=4:0.26 D2=0.22 | x=135 7x5 ar=0.71 holes=0 best=R:0.35 L=R:0.35 D=2:0.33 D2=0.33
- box=4 x=198.9 y=223.6 w=93.3 h=32.0 score=0.588 tilt=- crop=1 ink=true read=EBEP/0.0 glyphs=x=167 7x5 ar=0.71 holes=0 best=E:0.34 L=E:0.34 D=0:0.30 D2=0.30 | x=192 4x3 ar=0.75 holes=0 best=7:0.24 L=B:0.23 D=7:0.24 D2=0.22 | x=198 7x6 ar=0.86 holes=0 best=E:0.35 L=E:0.35 D=4:0.34 D2=0.32 | x=204 4x5 ar=1.25 holes=0 best=P:0.30 L=P:0.30 D=4:0.26 D2=0.26
- box=5 x=122.4 y=269.8 w=88.0 h=19.6 score=0.442 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=122.4 y=269.8 w=88.0 h=19.6 score=0.442 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-155 esperado=AUS6
- box=0 x=142.0 y=329.3 w=16.9 h=38.2 score=0.885 tilt=-83.4 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=142.0 y=329.3 w=16.9 h=38.2 score=0.885 tilt=-83.4 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=295.8 y=348.9 w=7.1 h=22.2 score=0.874 tilt=-88.4 crop=0 ink=false read=/0.0 glyphs=
- box=1 x=295.8 y=348.9 w=7.1 h=22.2 score=0.874 tilt=-88.4 crop=1 ink=false read=/0.0 glyphs=
- box=2 x=204.2 y=236.9 w=94.2 h=32.0 score=0.852 tilt=1.6 crop=0 ink=true read=MN 8/86.4 glyphs=x=159 55x51 ar=0.93 holes=1 best=M:0.88 L=M:0.88 D=4:0.84 D2=0.83 | x=214 58x55 ar=0.95 holes=0 best=N:0.76 L=N:0.76 D=0:0.75 D2=0.73 | x=294 47x59 ar=1.26 holes=2 best=8:0.96 L=B:0.91 D=8:0.96 D2=0.94
- box=2 x=204.2 y=236.9 w=94.2 h=32.0 score=0.852 tilt=1.6 crop=1 ink=true read=BE X/0.0 glyphs=x=160 47x59 ar=1.26 holes=2 best=8:0.93 L=E:0.92 D=8:0.93 D2=0.93 | x=229 57x55 ar=0.96 holes=0 best=E:0.72 L=E:0.72 D=0:0.70 D2=0.68 | x=286 56x51 ar=0.91 holes=1 best=W:0.83 L=W:0.83 D=8:0.82 D2=0.81
- box=3 x=86.0 y=254.7 w=33.8 h=9.8 score=0.649 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=254.7 w=33.8 h=9.8 score=0.649 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=232.7 y=269.8 w=44.4 h=13.3 score=0.642 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=232.7 y=269.8 w=44.4 h=13.3 score=0.642 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-157 esperado=AUS6
- box=0 x=171.3 y=276.0 w=80.9 h=31.1 score=0.915 tilt=3.0 crop=0 ink=true read=M XX/0.0 glyphs=x=141 46x50 ar=1.09 holes=0 best=M:0.90 L=M:0.90 D=0:0.87 D2=0.86 | x=187 52x56 ar=1.08 holes=1 best=5:0.84 L=E:0.77 D=5:0.84 D2=0.82 | x=259 43x58 ar=1.35 holes=2 best=8:0.95 L=B:0.93 D=8:0.95 D2=0.94
- box=0 x=171.3 y=276.0 w=80.9 h=31.1 score=0.915 tilt=3.0 crop=1 ink=true read=EE X/0.0 glyphs=x=143 43x58 ar=1.35 holes=2 best=9:0.94 L=E:0.91 D=9:0.94 D2=0.92 | x=206 47x56 ar=1.19 holes=1 best=E:0.86 L=E:0.86 D=9:0.82 D2=0.81 | x=253 51x50 ar=0.98 holes=0 best=N:0.86 L=N:0.86 D=8:0.85 D2=0.83
- box=1 x=107.3 y=332.0 w=72.9 h=39.1 score=0.792 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=107.3 y=332.0 w=72.9 h=39.1 score=0.792 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=295.6 w=19.6 h=8.9 score=0.742 tilt=- crop=0 ink=true read=/0.0 glyphs=x=53 22x23 ar=1.05 holes=0 best=0:0.93 L=W:0.90 D=0:0.93 D2=0.93
- box=2 x=86.0 y=295.6 w=19.6 h=8.9 score=0.742 tilt=- crop=1 ink=true read=/0.0 glyphs=x=289 22x23 ar=1.05 holes=0 best=8:0.94 L=W:0.90 D=8:0.94 D2=0.92
- box=3 x=190.0 y=287.6 w=24.9 h=12.4 score=0.696 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=190.0 y=287.6 w=24.9 h=12.4 score=0.696 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=195.3 y=306.2 w=40.0 h=14.2 score=0.695 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=195.3 y=306.2 w=40.0 h=14.2 score=0.695 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=254.7 w=31.1 h=11.6 score=0.657 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=254.7 w=31.1 h=11.6 score=0.657 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-160 esperado=AUS2
- box=0 x=271.8 y=293.8 w=19.6 h=40.9 score=0.658 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=271.8 y=293.8 w=19.6 h=40.9 score=0.658 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=285.1 y=342.7 w=8.9 h=28.4 score=0.557 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=285.1 y=342.7 w=8.9 h=28.4 score=0.557 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=210.4 y=289.3 w=65.8 h=13.3 score=0.468 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=210.4 y=289.3 w=65.8 h=13.3 score=0.468 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=304.7 y=343.6 w=7.1 h=27.6 score=0.444 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=304.7 y=343.6 w=7.1 h=27.6 score=0.444 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-172 esperado=RSA6
- box=0 x=187.3 y=311.6 w=84.4 h=28.4 score=0.908 tilt=0.4 crop=0 ink=true read=NGA 8/91.0 glyphs=x=164 19x50 ar=2.63 holes=0 best=N:0.90 L=N:0.90 D=1:0.74 D2=0.70 | x=183 52x54 ar=1.04 holes=1 best=G:0.83 L=G:0.83 D=6:0.82 D2=0.81 | x=235 36x51 ar=1.42 holes=1 best=A:0.95 L=A:0.95 D=4:0.86 D2=0.84 | x=286 45x56 ar=1.24 holes=2 best=8:0.97 L=O:0.90 D=8:0.97 D2=0.96
- box=0 x=187.3 y=311.6 w=84.4 h=28.4 score=0.908 tilt=0.4 crop=1 ink=true read=XXXX/0.0 glyphs=x=173 45x56 ar=1.24 holes=2 best=9:0.96 L=E:0.91 D=9:0.96 D2=0.94 | x=233 35x51 ar=1.46 holes=1 best=4:0.96 L=V:0.92 D=4:0.96 D2=0.81 | x=268 54x54 ar=1.00 holes=1 best=0:0.82 L=D:0.80 D=0:0.82 D2=0.81 | x=322 18x50 ar=2.78 holes=0 best=J:0.91 L=J:0.91 D=1:0.80 D2=0.74
- box=1 x=113.6 y=320.4 w=21.3 h=8.9 score=0.847 tilt=2.6 crop=0 ink=false read=/0.0 glyphs=
- box=1 x=113.6 y=320.4 w=21.3 h=8.9 score=0.847 tilt=2.6 crop=1 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=287.6 w=24.9 h=8.9 score=0.834 tilt=-7.1 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=287.6 w=24.9 h=8.9 score=0.834 tilt=-7.1 crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=319.6 w=25.8 h=9.8 score=0.762 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=319.6 w=25.8 h=9.8 score=0.762 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=99.3 y=341.8 w=114.7 h=29.3 score=0.656 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=99.3 y=341.8 w=114.7 h=29.3 score=0.656 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=208.7 y=320.4 w=24.9 h=12.4 score=0.531 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=208.7 y=320.4 w=24.9 h=12.4 score=0.531 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-174 esperado=RSA6
- box=0 x=112.7 y=287.6 w=22.2 h=8.0 score=0.815 tilt=4.3 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=112.7 y=287.6 w=22.2 h=8.0 score=0.815 tilt=4.3 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=201.6 y=276.9 w=77.3 h=25.8 score=0.740 tilt=- crop=0 ink=true read=RGA 8/91.5 glyphs=x=104 23x33 ar=1.43 holes=1 best=R:0.89 L=R:0.89 D=8:0.88 D2=0.85 | x=127 23x36 ar=1.57 holes=0 best=6:0.90 L=S:0.89 D=6:0.90 D2=0.88 | x=150 21x33 ar=1.57 holes=1 best=A:0.92 L=A:0.92 D=4:0.86 D2=0.84 | x=182 30x38 ar=1.27 holes=2 best=8:0.94 L=B:0.91 D=8:0.94 D2=0.94
- box=1 x=201.6 y=276.9 w=77.3 h=25.8 score=0.740 tilt=- crop=1 ink=true read=BVOM/88.0 glyphs=x=103 30x38 ar=1.27 holes=2 best=8:0.93 L=E:0.92 D=8:0.93 D2=0.93 | x=144 20x33 ar=1.65 holes=1 best=4:0.91 L=V:0.90 D=4:0.91 D2=0.82 | x=164 36x36 ar=1.00 holes=1 best=0:0.82 L=E:0.80 D=0:0.82 D2=0.81 | x=200 11x30 ar=2.73 holes=0 best=M:0.87 L=M:0.87 D=1:0.78 D2=0.71
- box=2 x=86.0 y=257.3 w=209.8 h=113.8 score=0.531 tilt=-12.0 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=257.3 w=209.8 h=113.8 score=0.531 tilt=-12.0 crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-175 esperado=RSA6
- box=0 x=230.9 y=267.1 w=93.3 h=40.0 score=0.901 tilt=5.8 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=230.9 y=267.1 w=93.3 h=40.0 score=0.901 tilt=5.8 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=291.3 y=312.4 w=20.4 h=58.7 score=0.785 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=291.3 y=312.4 w=20.4 h=58.7 score=0.785 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=154.4 y=280.4 w=23.1 h=8.9 score=0.765 tilt=- crop=0 ink=true read=/0.0 glyphs=x=114 48x39 ar=0.81 holes=0 best=0:0.91 L=W:0.88 D=0:0.91 D2=0.88
- box=2 x=154.4 y=280.4 w=23.1 h=8.9 score=0.765 tilt=- crop=1 ink=true read=/0.0 glyphs=x=264 48x39 ar=0.81 holes=0 best=0:0.89 L=W:0.87 D=0:0.89 D2=0.88
- box=3 x=86.0 y=263.6 w=34.7 h=9.8 score=0.602 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=263.6 w=34.7 h=9.8 score=0.602 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=252.9 w=28.4 h=6.2 score=0.511 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=252.9 w=28.4 h=6.2 score=0.511 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-176 esperado=RSA6
- box=0 x=235.3 y=263.6 w=90.7 h=40.0 score=0.899 tilt=5.9 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=235.3 y=263.6 w=90.7 h=40.0 score=0.899 tilt=5.9 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=294.0 y=307.1 w=19.6 h=64.0 score=0.670 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=294.0 y=307.1 w=19.6 h=64.0 score=0.670 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=159.8 y=276.0 w=24.0 h=9.8 score=0.651 tilt=- crop=0 ink=true read=/0.0 glyphs=x=76 28x24 ar=0.86 holes=0 best=0:0.88 L=N:0.87 D=0:0.88 D2=0.85
- box=2 x=159.8 y=276.0 w=24.0 h=9.8 score=0.651 tilt=- crop=1 ink=true read=/0.0 glyphs=x=154 28x24 ar=0.86 holes=0 best=0:0.87 L=N:0.86 D=0:0.87 D2=0.86
- box=3 x=86.0 y=249.3 w=25.8 h=6.2 score=0.554 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=249.3 w=25.8 h=6.2 score=0.554 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=255.8 y=281.3 w=24.0 h=12.4 score=0.539 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=255.8 y=281.3 w=24.0 h=12.4 score=0.539 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=117.1 y=274.2 w=41.8 h=10.7 score=0.444 tilt=- crop=0 ink=true read=/0.0 glyphs=x=306 2x5 ar=2.50 holes=0 best=T:0.30 L=T:0.30 D=1:0.29 D2=0.28
- box=5 x=117.1 y=274.2 w=41.8 h=10.7 score=0.444 tilt=- crop=1 ink=true read=/0.0 glyphs=x=89 2x5 ar=2.50 holes=0 best=K:0.30 L=K:0.30 D=4:0.26 D2=0.25
- box=6 x=87.8 y=260.9 w=36.4 h=8.0 score=0.430 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=87.8 y=260.9 w=36.4 h=8.0 score=0.430 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-182 esperado=EGY4
- box=0 x=255.8 y=278.7 w=85.3 h=30.2 score=0.981 tilt=-1.2 crop=0 ink=true read=EGY X/0.0 glyphs=x=152 22x52 ar=2.36 holes=0 best=E:0.89 L=E:0.89 D=6:0.80 D2=0.77 | x=174 40x54 ar=1.35 holes=0 best=G:0.87 L=G:0.87 D=6:0.85 D2=0.83 | x=214 37x48 ar=1.30 holes=0 best=Y:0.91 L=Y:0.91 D=4:0.83 D2=0.76 | x=272 47x52 ar=1.11 holes=0 best=4:0.93 L=E:0.86 D=4:0.93 D2=0.89
- box=0 x=255.8 y=278.7 w=85.3 h=30.2 score=0.981 tilt=-1.2 crop=1 ink=true read=EG 0/85.7 glyphs=x=159 47x52 ar=1.11 holes=0 best=E:0.93 L=E:0.93 D=8:0.87 D2=0.82 | x=227 36x48 ar=1.33 holes=0 best=G:0.91 L=G:0.91 D=4:0.84 D2=0.78 | x=263 63x54 ar=0.86 holes=1 best=0:0.73 L=N:0.73 D=0:0.73 D2=0.66
- box=1 x=358.0 y=293.8 w=36.4 h=15.1 score=0.770 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=358.0 y=293.8 w=36.4 h=15.1 score=0.770 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=329.6 y=321.3 w=11.6 h=39.1 score=0.635 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=329.6 y=321.3 w=11.6 h=39.1 score=0.635 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=172.2 y=300.0 w=159.1 h=71.1 score=0.557 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=172.2 y=300.0 w=159.1 h=71.1 score=0.557 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-186 esperado=NED12
- box=0 x=214.9 y=300.9 w=82.7 h=28.4 score=0.940 tilt=1.3 crop=0 ink=true read=NE XXX/0.0 glyphs=x=143 18x47 ar=2.61 holes=0 best=N:0.92 L=N:0.92 D=1:0.79 D2=0.76 | x=161 49x51 ar=1.04 holes=0 best=E:0.92 L=E:0.92 D=5:0.85 D2=0.83 | x=210 38x51 ar=1.34 holes=1 best=0:0.92 L=Q:0.92 D=0:0.92 D2=0.88 | x=272 32x51 ar=1.59 holes=0 best=1:0.98 L=X:0.87 D=1:0.98 D2=0.81 | x=304 43x52 ar=1.21 holes=0 best=2:0.97 L=Z:0.85 D=2:0.97 D2=0.86
- box=0 x=214.9 y=300.9 w=82.7 h=28.4 score=0.940 tilt=1.3 crop=1 ink=true read=BIQ XX/0.0 glyphs=x=149 41x52 ar=1.27 holes=0 best=8:0.88 L=B:0.84 D=8:0.88 D2=0.86 | x=190 34x51 ar=1.50 holes=0 best=1:0.89 L=T:0.88 D=1:0.89 D2=0.80 | x=248 37x51 ar=1.38 holes=1 best=Q:0.95 L=Q:0.95 D=0:0.91 D2=0.88 | x=285 50x51 ar=1.02 holes=0 best=0:0.84 L=W:0.84 D=0:0.84 D2=0.81 | x=335 18x47 ar=2.61 holes=0 best=4:0.82 L=J:0.81 D=4:0.82 D2=0.79
- box=1 x=86.0 y=284.9 w=26.7 h=8.9 score=0.712 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=284.9 w=26.7 h=8.9 score=0.712 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=143.8 y=314.2 w=21.3 h=8.0 score=0.697 tilt=- crop=0 ink=true read=/0.0 glyphs=x=124 56x48 ar=0.86 holes=0 best=0:0.92 L=W:0.88 D=0:0.92 D2=0.89
- box=2 x=143.8 y=314.2 w=21.3 h=8.0 score=0.697 tilt=- crop=1 ink=true read=/0.0 glyphs=x=288 56x48 ar=0.86 holes=0 best=0:0.89 L=E:0.87 D=0:0.89 D2=0.88
- box=3 x=128.7 y=327.6 w=152.0 h=43.6 score=0.681 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=128.7 y=327.6 w=152.0 h=43.6 score=0.681 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=142.0 y=349.8 w=82.7 h=21.3 score=0.608 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=142.0 y=349.8 w=82.7 h=21.3 score=0.608 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=104.7 y=314.2 w=37.3 h=8.9 score=0.445 tilt=- crop=0 ink=true read=/0.0 glyphs=x=155 17x20 ar=1.18 holes=0 best=0:0.90 L=W:0.88 D=0:0.90 D2=0.89
- box=5 x=104.7 y=314.2 w=37.3 h=8.9 score=0.445 tilt=- crop=1 ink=true read=/0.0 glyphs=x=237 17x20 ar=1.18 holes=0 best=8:0.88 L=E:0.86 D=8:0.88 D2=0.87
### pixel-live-20260617-090351__frame-189 esperado=NED12
- box=0 x=196.2 y=324.9 w=50.7 h=17.8 score=0.819 tilt=-1.0 crop=0 ink=true read=EO X/0.0 glyphs=x=142 66x56 ar=0.85 holes=1 best=E:0.86 L=E:0.86 D=8:0.76 D2=0.74 | x=207 39x54 ar=1.38 holes=1 best=0:0.85 L=D:0.81 D=0:0.85 D2=0.81 | x=266 71x58 ar=0.82 holes=0 best=0:0.79 L=M:0.77 D=0:0.79 D2=0.77
- box=0 x=196.2 y=324.9 w=50.7 h=17.8 score=0.819 tilt=-1.0 crop=1 ink=true read=BGN/84.2 glyphs=x=137 71x58 ar=0.82 holes=0 best=8:0.79 L=O:0.76 D=8:0.79 D2=0.78 | x=228 39x54 ar=1.38 holes=1 best=G:0.86 L=G:0.86 D=0:0.84 D2=0.83 | x=266 66x56 ar=0.85 holes=1 best=N:0.87 L=N:0.87 D=0:0.77 D2=0.74
- box=1 x=86.0 y=300.9 w=24.9 h=10.7 score=0.714 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=300.9 w=24.9 h=10.7 score=0.714 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=133.1 y=344.4 w=81.8 h=26.7 score=0.712 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=133.1 y=344.4 w=81.8 h=26.7 score=0.712 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=141.1 y=322.2 w=53.3 h=16.0 score=0.649 tilt=- crop=0 ink=false read=I X/0.0 glyphs=x=37 6x9 ar=1.50 holes=0 best=I:0.53 L=I:0.53 D=5:0.48 D2=0.48 | x=191 4x6 ar=1.50 holes=0 best=8:0.36 L=N:0.34 D=8:0.36 D2=0.34
- box=3 x=141.1 y=322.2 w=53.3 h=16.0 score=0.649 tilt=- crop=1 ink=false read=KI/0.0 glyphs=x=156 4x6 ar=1.50 holes=0 best=K:0.34 L=K:0.34 D=4:0.32 D2=0.32 | x=308 6x9 ar=1.50 holes=0 best=I:0.53 L=I:0.53 D=4:0.49 D2=0.48
- box=4 x=105.6 y=331.1 w=34.7 h=7.1 score=0.394 tilt=- crop=0 ink=true read=/0.0 glyphs=x=375 2x5 ar=2.50 holes=0 best=T:0.32 L=T:0.32 D=1:0.30 D2=0.28
- box=4 x=105.6 y=331.1 w=34.7 h=7.1 score=0.394 tilt=- crop=1 ink=true read=/0.0 glyphs=x=116 2x5 ar=2.50 holes=0 best=K:0.29 L=K:0.29 D=4:0.26 D2=0.25
- box=5 x=86.0 y=323.1 w=33.8 h=8.0 score=0.292 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=323.1 w=33.8 h=8.0 score=0.292 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-190 esperado=NED12
- box=0 x=182.9 y=264.4 w=82.7 h=41.8 score=0.900 tilt=14.8 crop=0 ink=true read=12/87.3 glyphs=x=277 20x41 ar=2.05 holes=0 best=1:0.89 L=J:0.84 D=1:0.89 D2=0.83 | x=305 39x42 ar=1.08 holes=0 best=2:0.86 L=P:0.74 D=2:0.86 D2=0.78
- box=0 x=182.9 y=264.4 w=82.7 h=41.8 score=0.900 tilt=14.8 crop=1 ink=true read=ZT/81.0 glyphs=x=224 39x42 ar=1.08 holes=0 best=2:0.77 L=B:0.73 D=2:0.77 D2=0.76 | x=271 20x41 ar=2.05 holes=0 best=T:0.85 L=T:0.85 D=1:0.77 D2=0.71
- box=1 x=245.1 y=304.4 w=14.2 h=35.6 score=0.748 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=245.1 y=304.4 w=14.2 h=35.6 score=0.748 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=210.4 y=302.7 w=31.1 h=8.9 score=0.616 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=210.4 y=302.7 w=31.1 h=8.9 score=0.616 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.9 y=300.0 w=32.9 h=9.8 score=0.442 tilt=- crop=0 ink=false read=/0.0 glyphs=x=135 12x15 ar=1.25 holes=0 best=W:0.83 L=W:0.83 D=0:0.82 D2=0.82
- box=3 x=86.9 y=300.0 w=32.9 h=9.8 score=0.442 tilt=- crop=1 ink=false read=/0.0 glyphs=x=194 12x15 ar=1.25 holes=0 best=8:0.84 L=W:0.81 D=8:0.84 D2=0.82
- box=4 x=86.0 y=292.0 w=32.0 h=8.9 score=0.413 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=292.0 w=32.0 h=8.9 score=0.413 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-193 esperado=RSA19
- box=0 x=217.6 y=242.2 w=87.1 h=31.1 score=0.862 tilt=2.8 crop=0 ink=true read=RSA XX/0.0 glyphs=x=142 32x45 ar=1.41 holes=1 best=R:0.85 L=R:0.85 D=8:0.82 D2=0.81 | x=174 31x53 ar=1.71 holes=0 best=S:0.93 L=S:0.93 D=6:0.89 D2=0.89 | x=205 36x51 ar=1.42 holes=0 best=A:0.91 L=A:0.91 D=4:0.86 D2=0.85 | x=258 33x55 ar=1.67 holes=0 best=1:0.97 L=I:0.86 D=1:0.97 D2=0.84 | x=291 48x58 ar=1.21 holes=2 best=9:0.95 L=E:0.90 D=9:0.95 D2=0.93
- box=0 x=217.6 y=242.2 w=87.1 h=31.1 score=0.862 tilt=2.8 crop=1 ink=true read=BIVR/88.4 glyphs=x=136 47x58 ar=1.23 holes=2 best=8:0.95 L=B:0.91 D=8:0.95 D2=0.93 | x=183 34x55 ar=1.62 holes=0 best=1:0.90 L=T:0.89 D=1:0.90 D2=0.81 | x=234 33x51 ar=1.55 holes=0 best=4:0.92 L=V:0.91 D=4:0.92 D2=0.84 | x=267 66x53 ar=0.80 holes=2 best=R:0.78 L=R:0.78 D=0:0.71 D2=0.71
- box=1 x=235.3 y=252.9 w=25.8 h=11.6 score=0.684 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=235.3 y=252.9 w=25.8 h=11.6 score=0.684 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=231.6 w=36.4 h=12.4 score=0.623 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=231.6 w=36.4 h=12.4 score=0.623 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=113.6 y=260.9 w=32.9 h=9.8 score=0.536 tilt=- crop=0 ink=false read=/0.0 glyphs=x=127 14x16 ar=1.14 holes=0 best=W:0.91 L=W:0.91 D=0:0.89 D2=0.88
- box=3 x=113.6 y=260.9 w=32.9 h=9.8 score=0.536 tilt=- crop=1 ink=false read=/0.0 glyphs=x=200 14x16 ar=1.14 holes=0 best=8:0.90 L=W:0.86 D=8:0.90 D2=0.87
- box=4 x=296.7 y=284.9 w=8.9 h=37.3 score=0.354 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=296.7 y=284.9 w=8.9 h=37.3 score=0.354 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-201 esperado=SCO16
- box=0 x=168.7 y=247.6 w=102.2 h=38.2 score=0.757 tilt=- crop=0 ink=true read=/0.0 glyphs=x=83 12x27 ar=2.25 holes=0 best=L:0.69 L=L:0.69 D=1:0.62 D2=0.58
- box=0 x=168.7 y=247.6 w=102.2 h=38.2 score=0.757 tilt=- crop=1 ink=true read=/0.0 glyphs=x=195 12x27 ar=2.25 holes=0 best=U:0.62 L=U:0.62 D=7:0.62 D2=0.59
- box=1 x=86.0 y=236.9 w=34.7 h=12.4 score=0.686 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=236.9 w=34.7 h=12.4 score=0.686 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=114.4 y=268.0 w=42.7 h=12.4 score=0.477 tilt=- crop=0 ink=false read=/0.0 glyphs=x=142 13x10 ar=0.77 holes=0 best=N:0.66 L=N:0.66 D=8:0.63 D2=0.60
- box=2 x=114.4 y=268.0 w=42.7 h=12.4 score=0.477 tilt=- crop=1 ink=false read=/0.0 glyphs=x=210 13x10 ar=0.77 holes=0 best=N:0.69 L=N:0.69 D=4:0.65 D2=0.65
### pixel-live-20260617-090351__frame-202 esperado=SCO16
- box=0 x=195.3 y=259.1 w=100.4 h=39.1 score=0.814 tilt=- crop=0 ink=true read=SCU XX/0.0 glyphs=x=81 17x25 ar=1.47 holes=0 best=5:0.70 L=Y:0.67 D=5:0.70 D2=0.66 | x=98 18x26 ar=1.44 holes=0 best=C:0.83 L=C:0.83 D=6:0.76 D2=0.73 | x=116 21x27 ar=1.29 holes=1 best=U:0.82 L=U:0.82 D=0:0.80 D2=0.79 | x=150 17x28 ar=1.65 holes=0 best=1:0.94 L=M:0.83 D=1:0.94 D2=0.76 | x=167 24x29 ar=1.21 holes=2 best=6:0.97 L=O:0.90 D=6:0.97 D2=0.94
- box=0 x=195.3 y=259.1 w=100.4 h=39.1 score=0.814 tilt=- crop=1 ink=true read=EI XXX/0.0 glyphs=x=85 23x29 ar=1.26 holes=2 best=9:0.94 L=E:0.92 D=9:0.94 D2=0.91 | x=108 18x28 ar=1.56 holes=0 best=1:0.88 L=T:0.86 D=1:0.88 D2=0.80 | x=139 20x27 ar=1.35 holes=1 best=0:0.87 L=Y:0.87 D=0:0.87 D2=0.79 | x=159 27x27 ar=1.00 holes=0 best=7:0.65 L=J:0.57 D=7:0.65 D2=0.60 | x=186 9x22 ar=2.44 holes=0 best=U:0.68 L=U:0.68 D=1:0.61 D2=0.59
- box=1 x=115.3 y=325.8 w=90.7 h=45.3 score=0.801 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=115.3 y=325.8 w=90.7 h=45.3 score=0.801 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=350.9 y=293.8 w=43.6 h=16.0 score=0.748 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=350.9 y=293.8 w=43.6 h=16.0 score=0.748 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=286.7 w=30.2 h=9.8 score=0.744 tilt=- crop=0 ink=true read=/0.0 glyphs=
- box=3 x=86.0 y=286.7 w=30.2 h=9.8 score=0.744 tilt=- crop=1 ink=true read=/0.0 glyphs=
- box=4 x=86.0 y=252.0 w=31.1 h=12.4 score=0.730 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=252.0 w=31.1 h=12.4 score=0.730 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=142.9 y=280.4 w=42.7 h=12.4 score=0.463 tilt=- crop=0 ink=false read=/0.0 glyphs=x=137 13x13 ar=1.00 holes=0 best=0:0.77 L=W:0.72 D=0:0.77 D2=0.75
- box=5 x=142.9 y=280.4 w=42.7 h=12.4 score=0.463 tilt=- crop=1 ink=false read=/0.0 glyphs=x=215 13x13 ar=1.00 holes=0 best=0:0.76 L=E:0.71 D=0:0.76 D2=0.74
### pixel-live-20260617-090351__frame-204 esperado=SCO16
- box=0 x=158.9 y=264.4 w=25.8 h=9.8 score=0.846 tilt=3.1 crop=0 ink=true read=OI/88.1 glyphs=x=110 54x47 ar=0.87 holes=0 best=0:0.90 L=N:0.87 D=0:0.90 D2=0.86 | x=164 5x33 ar=6.60 holes=0 best=I:0.87 L=I:0.87 D=1:0.69 D2=0.53
- box=0 x=158.9 y=264.4 w=25.8 h=9.8 score=0.846 tilt=3.1 crop=1 ink=true read=OI/86.7 glyphs=x=274 54x47 ar=0.87 holes=0 best=0:0.91 L=N:0.88 D=0:0.91 D2=0.88 | x=328 5x25 ar=5.00 holes=0 best=I:0.82 L=I:0.82 D=1:0.66 D2=0.50
- box=1 x=244.2 y=243.1 w=98.7 h=40.9 score=0.827 tilt=5.7 crop=0 ink=false read=II/0.0 glyphs=x=141 8x19 ar=2.38 holes=0 best=I:0.77 L=I:0.77 D=1:0.65 D2=0.58 | x=167 4x10 ar=2.50 holes=0 best=I:0.53 L=I:0.53 D=1:0.52 D2=0.52
- box=1 x=244.2 y=243.1 w=98.7 h=40.9 score=0.827 tilt=5.7 crop=1 ink=false read=CI/0.0 glyphs=x=92 4x10 ar=2.50 holes=0 best=C:0.49 L=C:0.49 D=6:0.44 D2=0.42 | x=114 8x19 ar=2.38 holes=0 best=I:0.68 L=I:0.68 D=7:0.59 D2=0.54
- box=2 x=343.8 y=241.3 w=50.7 h=129.8 score=0.731 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=343.8 y=241.3 w=50.7 h=129.8 score=0.731 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=266.2 w=20.4 h=8.9 score=0.729 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=266.2 w=20.4 h=8.9 score=0.729 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=229.8 w=34.7 h=11.6 score=0.622 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=229.8 w=34.7 h=11.6 score=0.622 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=315.3 y=289.3 w=23.1 h=81.8 score=0.525 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=315.3 y=289.3 w=23.1 h=81.8 score=0.525 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=108.2 y=264.4 w=48.0 h=10.7 score=0.429 tilt=- crop=0 ink=true read=/0.0 glyphs=x=171 23x22 ar=0.96 holes=0 best=0:0.93 L=W:0.86 D=0:0.93 D2=0.92
- box=6 x=108.2 y=264.4 w=48.0 h=10.7 score=0.429 tilt=- crop=1 ink=true read=/0.0 glyphs=x=260 23x22 ar=0.96 holes=0 best=0:0.91 L=W:0.87 D=0:0.91 D2=0.91
- box=7 x=187.3 y=264.4 w=46.2 h=9.8 score=0.400 tilt=- crop=0 ink=true read=/0.0 glyphs=x=177 22x20 ar=0.91 holes=0 best=0:0.90 L=W:0.89 D=0:0.90 D2=0.88
- box=7 x=187.3 y=264.4 w=46.2 h=9.8 score=0.400 tilt=- crop=1 ink=true read=/0.0 glyphs=x=265 22x20 ar=0.91 holes=0 best=8:0.90 L=W:0.87 D=8:0.90 D2=0.88
### pixel-live-20260617-090351__frame-205 esperado=SCO16
- box=0 x=86.0 y=350.7 w=10.7 h=20.4 score=0.886 tilt=-83.6 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=350.7 w=10.7 h=20.4 score=0.886 tilt=-83.6 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=235.3 y=244.9 w=96.0 h=40.0 score=0.859 tilt=6.0 crop=0 ink=false read=/0.0 glyphs=x=116 10x2 ar=0.20 holes=0 best=E:0.34 L=E:0.34 D=5:0.31 D2=0.31
- box=1 x=235.3 y=244.9 w=96.0 h=40.0 score=0.859 tilt=6.0 crop=1 ink=false read=/0.0 glyphs=x=287 10x2 ar=0.20 holes=0 best=H:0.32 L=H:0.32 D=0:0.30 D2=0.29
- box=2 x=153.6 y=266.2 w=25.8 h=9.8 score=0.801 tilt=- crop=0 ink=true read=/0.0 glyphs=x=121 54x46 ar=0.85 holes=0 best=0:0.89 L=W:0.88 D=0:0.89 D2=0.86
- box=2 x=153.6 y=266.2 w=25.8 h=9.8 score=0.801 tilt=- crop=1 ink=true read=/0.0 glyphs=x=268 54x46 ar=0.85 holes=0 best=0:0.88 L=N:0.87 D=0:0.88 D2=0.86
- box=3 x=86.0 y=233.3 w=34.7 h=10.7 score=0.536 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=233.3 w=34.7 h=10.7 score=0.536 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=302.9 y=289.3 w=24.0 h=81.8 score=0.529 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=302.9 y=289.3 w=24.0 h=81.8 score=0.529 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=351.8 y=293.8 w=42.7 h=9.8 score=0.445 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=351.8 y=293.8 w=42.7 h=9.8 score=0.445 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=105.6 y=267.1 w=45.3 h=8.9 score=0.399 tilt=- crop=0 ink=true read=/0.0 glyphs=x=185 22x26 ar=1.18 holes=0 best=8:0.93 L=W:0.92 D=8:0.93 D2=0.93
- box=6 x=105.6 y=267.1 w=45.3 h=8.9 score=0.399 tilt=- crop=1 ink=true read=/0.0 glyphs=x=283 22x26 ar=1.18 holes=0 best=8:0.93 L=W:0.89 D=8:0.93 D2=0.91
### pixel-live-20260617-090351__frame-206 esperado=SCO16
- box=0 x=123.3 y=323.1 w=102.2 h=48.0 score=0.819 tilt=0.2 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=123.3 y=323.1 w=102.2 h=48.0 score=0.819 tilt=0.2 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=213.1 y=260.0 w=104.9 h=35.6 score=0.788 tilt=1.2 crop=0 ink=true read=SXJ 18/88.8 glyphs=x=90 30x32 ar=1.07 holes=0 best=9:0.80 L=S:0.79 D=9:0.80 D2=0.77 | x=120 38x34 ar=0.89 holes=1 best=N:0.75 L=N:0.75 D=0:0.75 D2=0.67 | x=172 21x32 ar=1.52 holes=0 best=1:0.97 L=X:0.86 D=1:0.97 D2=0.83 | x=193 29x34 ar=1.17 holes=2 best=8:0.96 L=B:0.91 D=8:0.96 D2=0.95
- box=1 x=213.1 y=260.0 w=104.9 h=35.6 score=0.788 tilt=1.2 crop=1 ink=true read=EICX X/0.0 glyphs=x=90 28x34 ar=1.21 holes=2 best=9:0.94 L=E:0.91 D=9:0.94 D2=0.93 | x=118 22x32 ar=1.45 holes=0 best=1:0.89 L=T:0.87 D=1:0.89 D2=0.80 | x=154 13x33 ar=2.54 holes=0 best=C:0.85 L=C:0.85 D=6:0.76 D2=0.72 | x=167 23x34 ar=1.48 holes=0 best=X:0.82 L=X:0.82 D=5:0.74 D2=0.74 | x=190 32x32 ar=1.00 holes=0 best=8:0.78 L=G:0.78 D=8:0.78 D2=0.77
- box=2 x=121.6 y=277.8 w=27.6 h=10.7 score=0.782 tilt=4.5 crop=0 ink=true read=/0.0 glyphs=x=120 49x50 ar=1.02 holes=0 best=0:0.92 L=W:0.87 D=0:0.92 D2=0.90
- box=2 x=121.6 y=277.8 w=27.6 h=10.7 score=0.782 tilt=4.5 crop=1 ink=true read=/0.0 glyphs=x=268 49x50 ar=1.02 holes=0 best=0:0.91 L=E:0.85 D=0:0.91 D2=0.90
- box=3 x=86.0 y=278.7 w=33.8 h=10.7 score=0.760 tilt=2.1 crop=0 ink=true read=/0.0 glyphs=x=104 35x38 ar=1.09 holes=0 best=8:0.94 L=W:0.89 D=8:0.94 D2=0.92
- box=3 x=86.0 y=278.7 w=33.8 h=10.7 score=0.760 tilt=2.1 crop=1 ink=true read=/0.0 glyphs=x=384 35x38 ar=1.09 holes=0 best=8:0.94 L=W:0.90 D=8:0.94 D2=0.92
- box=4 x=151.8 y=275.1 w=49.8 h=11.6 score=0.393 tilt=- crop=0 ink=true read=/0.0 glyphs=x=171 18x16 ar=0.89 holes=0 best=0:0.90 L=E:0.85 D=0:0.90 D2=0.89
- box=4 x=151.8 y=275.1 w=49.8 h=11.6 score=0.393 tilt=- crop=1 ink=true read=/0.0 glyphs=x=251 18x16 ar=0.89 holes=0 best=0:0.93 L=W:0.87 D=0:0.93 D2=0.90
### pixel-live-20260617-090351__frame-223 esperado=EGY5
- box=0 x=234.4 y=298.2 w=71.1 h=28.4 score=0.930 tilt=2.7 crop=0 ink=true read=SDY X/0.0 glyphs=x=139 18x50 ar=2.78 holes=0 best=S:0.85 L=S:0.85 D=1:0.72 D2=0.71 | x=157 36x52 ar=1.44 holes=0 best=D:0.84 L=D:0.84 D=6:0.81 D2=0.79 | x=193 34x45 ar=1.32 holes=0 best=Y:0.92 L=Y:0.92 D=4:0.84 D2=0.75 | x=246 41x56 ar=1.37 holes=0 best=5:0.93 L=B:0.88 D=5:0.93 D2=0.91
- box=0 x=234.4 y=298.2 w=71.1 h=28.4 score=0.930 tilt=2.7 crop=1 ink=true read=EG X/0.0 glyphs=x=143 41x56 ar=1.37 holes=0 best=E:0.93 L=E:0.93 D=9:0.91 D2=0.86 | x=203 33x45 ar=1.36 holes=0 best=G:0.91 L=G:0.91 D=4:0.84 D2=0.79 | x=236 55x52 ar=0.95 holes=2 best=M:0.70 L=M:0.70 D=0:0.69 D2=0.67
- box=1 x=176.7 y=347.1 w=60.4 h=24.0 score=0.795 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=176.7 y=347.1 w=60.4 h=24.0 score=0.795 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-224 esperado=EGY5
- box=0 x=227.3 y=301.8 w=68.4 h=26.7 score=0.806 tilt=2.8 crop=0 ink=true read=FGY X/0.0 glyphs=x=90 13x22 ar=1.69 holes=0 best=F:0.79 L=F:0.79 D=0:0.70 D2=0.68 | x=104 20x34 ar=1.70 holes=0 best=6:0.88 L=S:0.87 D=6:0.88 D2=0.88 | x=124 21x29 ar=1.38 holes=0 best=Y:0.90 L=Y:0.90 D=4:0.85 D2=0.74 | x=156 25x35 ar=1.40 holes=2 best=5:0.94 L=S:0.87 D=5:0.94 D2=0.91
- box=0 x=227.3 y=301.8 w=68.4 h=26.7 score=0.806 tilt=2.8 crop=1 ink=true read=EG XX/0.0 glyphs=x=95 25x35 ar=1.40 holes=2 best=E:0.91 L=E:0.91 D=9:0.90 D2=0.88 | x=131 21x29 ar=1.38 holes=0 best=G:0.90 L=G:0.90 D=4:0.82 D2=0.78 | x=152 20x34 ar=1.70 holes=0 best=9:0.91 L=S:0.87 D=9:0.91 D2=0.88 | x=173 13x22 ar=1.69 holes=0 best=4:0.74 L=X:0.72 D=4:0.74 D2=0.74
- box=1 x=168.7 y=348.9 w=60.4 h=22.2 score=0.800 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=168.7 y=348.9 w=60.4 h=22.2 score=0.800 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=247.8 y=328.4 w=38.2 h=8.9 score=0.463 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=247.8 y=328.4 w=38.2 h=8.9 score=0.463 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=311.8 y=281.3 w=21.3 h=89.8 score=0.381 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=311.8 y=281.3 w=21.3 h=89.8 score=0.381 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-226 esperado=TUN10
- box=0 x=135.8 y=277.8 w=21.3 h=9.8 score=0.748 tilt=- crop=0 ink=true read=/0.0 glyphs=x=108 35x38 ar=1.09 holes=0 best=8:0.91 L=W:0.89 D=8:0.91 D2=0.90
- box=0 x=135.8 y=277.8 w=21.3 h=9.8 score=0.748 tilt=- crop=1 ink=true read=/0.0 glyphs=x=232 35x38 ar=1.09 holes=0 best=0:0.91 L=W:0.87 D=0:0.91 D2=0.91
- box=1 x=86.0 y=244.9 w=32.9 h=13.3 score=0.728 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=244.9 w=32.9 h=13.3 score=0.728 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=283.3 y=297.3 w=17.8 h=73.8 score=0.681 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=283.3 y=297.3 w=17.8 h=73.8 score=0.681 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=97.6 y=278.7 w=36.4 h=10.7 score=0.513 tilt=- crop=0 ink=false read=/0.0 glyphs=x=139 9x11 ar=1.22 holes=0 best=8:0.64 L=W:0.63 D=8:0.64 D2=0.63
- box=3 x=97.6 y=278.7 w=36.4 h=10.7 score=0.513 tilt=- crop=1 ink=false read=/0.0 glyphs=x=204 9x11 ar=1.22 holes=0 best=E:0.64 L=E:0.64 D=8:0.63 D2=0.63
- box=4 x=159.8 y=276.0 w=40.0 h=9.8 score=0.418 tilt=- crop=0 ink=true read=/0.0 glyphs=x=155 20x18 ar=0.90 holes=0 best=0:0.92 L=W:0.87 D=0:0.92 D2=0.90
- box=4 x=159.8 y=276.0 w=40.0 h=9.8 score=0.418 tilt=- crop=1 ink=true read=/0.0 glyphs=x=234 20x18 ar=0.90 holes=0 best=0:0.91 L=W:0.85 D=0:0.91 D2=0.91
- box=5 x=116.2 y=292.0 w=161.8 h=79.1 score=0.407 tilt=8.3 crop=0 ink=false read=/0.0 glyphs=
- box=5 x=116.2 y=292.0 w=161.8 h=79.1 score=0.407 tilt=8.3 crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-230 esperado=TUN10
- box=0 x=86.0 y=260.0 w=32.0 h=13.3 score=0.647 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=260.0 w=32.0 h=13.3 score=0.647 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=306.4 y=297.3 w=21.3 h=73.8 score=0.591 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=306.4 y=297.3 w=21.3 h=73.8 score=0.591 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=135.8 y=293.8 w=168.9 h=77.3 score=0.485 tilt=9.0 crop=0 ink=false read=/0.0 glyphs=x=220 11x10 ar=0.91 holes=0 best=D:0.58 L=D:0.58 D=0:0.54 D2=0.48
- box=2 x=135.8 y=293.8 w=168.9 h=77.3 score=0.485 tilt=9.0 crop=1 ink=false read=/0.0 glyphs=x=45 11x10 ar=0.91 holes=0 best=D:0.56 L=D:0.56 D=0:0.53 D2=0.48
### pixel-live-20260617-090351__frame-233 esperado=TUN10
- box=0 x=102.0 y=332.9 w=98.7 h=38.2 score=0.928 tilt=1.7 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=102.0 y=332.9 w=98.7 h=38.2 score=0.928 tilt=1.7 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=206.9 y=285.8 w=25.8 h=13.3 score=0.760 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=206.9 y=285.8 w=25.8 h=13.3 score=0.760 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=249.6 y=308.0 w=23.1 h=63.1 score=0.730 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=249.6 y=308.0 w=23.1 h=63.1 score=0.730 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=96.7 y=291.1 w=30.2 h=12.4 score=0.707 tilt=- crop=0 ink=true read=OI/89.2 glyphs=x=114 45x39 ar=0.87 holes=0 best=0:0.91 L=N:0.86 D=0:0.91 D2=0.87 | x=159 4x33 ar=8.25 holes=0 best=I:0.88 L=I:0.88 D=1:0.69 D2=0.50
- box=3 x=96.7 y=291.1 w=30.2 h=12.4 score=0.707 tilt=- crop=1 ink=true read=OI/90.6 glyphs=x=264 45x39 ar=0.87 holes=0 best=0:0.90 L=N:0.86 D=0:0.90 D2=0.88 | x=309 4x22 ar=5.50 holes=0 best=I:0.91 L=I:0.91 D=1:0.72 D2=0.56
- box=4 x=86.0 y=247.6 w=30.2 h=8.9 score=0.605 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=247.6 w=30.2 h=8.9 score=0.605 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=130.4 y=288.4 w=48.0 h=12.4 score=0.395 tilt=- crop=0 ink=true read=/0.0 glyphs=x=159 22x20 ar=0.91 holes=0 best=0:0.87 L=W:0.86 D=0:0.87 D2=0.86
- box=5 x=130.4 y=288.4 w=48.0 h=12.4 score=0.395 tilt=- crop=1 ink=true read=/0.0 glyphs=x=224 22x20 ar=0.91 holes=0 best=0:0.88 L=W:0.86 D=0:0.88 D2=0.87
### pixel-live-20260617-090351__frame-234 esperado=TUN10
- box=0 x=271.8 y=304.4 w=66.7 h=23.1 score=0.803 tilt=- crop=0 ink=true read=/0.0 glyphs=x=95 4x6 ar=1.50 holes=0 best=1:0.39 L=J:0.38 D=1:0.39 D2=0.33
- box=0 x=271.8 y=304.4 w=66.7 h=23.1 score=0.803 tilt=- crop=1 ink=true read=/0.0 glyphs=x=206 4x6 ar=1.50 holes=0 best=F:0.34 L=F:0.34 D=8:0.26 D2=0.25
- box=1 x=214.9 y=336.4 w=63.1 h=34.7 score=0.737 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=214.9 y=336.4 w=63.1 h=34.7 score=0.737 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-235 esperado=TUN10
- box=0 x=214.0 y=262.7 w=70.2 h=43.6 score=0.737 tilt=13.5 crop=0 ink=true read=10/92.5 glyphs=x=199 19x38 ar=2.00 holes=0 best=1:0.91 L=J:0.82 D=1:0.91 D2=0.81 | x=222 33x39 ar=1.18 holes=1 best=Q:0.95 L=Q:0.95 D=0:0.94 D2=0.89
- box=0 x=214.0 y=262.7 w=70.2 h=43.6 score=0.737 tilt=13.5 crop=1 ink=true read=QT/91.3 glyphs=x=145 33x39 ar=1.18 holes=1 best=Q:0.93 L=Q:0.93 D=0:0.91 D2=0.88 | x=182 19x38 ar=2.00 holes=0 best=T:0.89 L=T:0.89 D=1:0.79 D2=0.68
- box=1 x=130.4 y=316.9 w=16.9 h=54.2 score=0.727 tilt=- crop=0 ink=true read=EI X/0.0 glyphs=x=61 22x22 ar=1.00 holes=0 best=E:0.83 L=E:0.83 D=8:0.81 D2=0.81 | x=331 38x41 ar=1.08 holes=0 best=1:0.84 L=Y:0.81 D=1:0.84 D2=0.81 | x=383 31x40 ar=1.29 holes=0 best=E:0.86 L=E:0.86 D=8:0.85 D2=0.84
- box=1 x=130.4 y=316.9 w=16.9 h=54.2 score=0.727 tilt=- crop=1 ink=true read=XXX/0.0 glyphs=x=133 31x40 ar=1.29 holes=0 best=1:0.89 L=X:0.85 D=1:0.89 D2=0.87 | x=178 38x41 ar=1.08 holes=0 best=8:0.84 L=X:0.83 D=8:0.84 D2=0.83 | x=464 22x22 ar=1.00 holes=0 best=4:0.87 L=E:0.83 D=4:0.87 D2=0.86
- box=2 x=263.8 y=309.8 w=25.8 h=61.3 score=0.704 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=263.8 y=309.8 w=25.8 h=61.3 score=0.704 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=272.4 w=34.7 h=98.7 score=0.547 tilt=- crop=0 ink=false read=/0.0 glyphs=x=29 7x1 ar=0.14 holes=0 best=H:0.21 L=H:0.21 D=5:0.19 D2=0.19
- box=3 x=86.0 y=272.4 w=34.7 h=98.7 score=0.547 tilt=- crop=1 ink=false read=/0.0 glyphs=x=266 7x1 ar=0.14 holes=0 best=H:0.21 L=H:0.21 D=5:0.19 D2=0.19
### pixel-live-20260617-090351__frame-236 esperado=TUN10
- box=0 x=358.9 y=293.8 w=35.6 h=77.3 score=0.949 tilt=85.4 crop=0 ink=false read=/0.0 glyphs=x=274 7x1 ar=0.14 holes=0 best=H:0.21 L=H:0.21 D=5:0.19 D2=0.19
- box=0 x=358.9 y=293.8 w=35.6 h=77.3 score=0.949 tilt=85.4 crop=1 ink=false read=/0.0 glyphs=x=97 7x1 ar=0.14 holes=0 best=H:0.21 L=H:0.21 D=5:0.19 D2=0.19
- box=1 x=354.4 y=287.6 w=40.0 h=21.3 score=0.883 tilt=- crop=0 ink=false read=/0.0 glyphs=x=217 17x2 ar=0.12 holes=0 best=H:0.37 L=H:0.37 D=9:0.33 D2=0.33
- box=1 x=354.4 y=287.6 w=40.0 h=21.3 score=0.883 tilt=- crop=1 ink=false read=/0.0 glyphs=x=91 17x2 ar=0.12 holes=0 best=M:0.38 L=M:0.38 D=9:0.31 D2=0.31
- box=2 x=230.9 y=277.8 w=123.6 h=39.1 score=0.778 tilt=- crop=0 ink=true read=/0.0 glyphs=x=308 4x2 ar=0.50 holes=0 best=E:0.23 L=E:0.23 D=4:0.20 D2=0.20
- box=2 x=230.9 y=277.8 w=123.6 h=39.1 score=0.778 tilt=- crop=1 ink=true read=/0.0 glyphs=x=20 4x2 ar=0.50 holes=0 best=E:0.23 L=E:0.23 D=4:0.20 D2=0.20
- box=3 x=86.0 y=291.1 w=28.4 h=13.3 score=0.724 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=291.1 w=28.4 h=13.3 score=0.724 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=117.1 y=291.1 w=32.9 h=13.3 score=0.703 tilt=- crop=0 ink=true read=/0.0 glyphs=x=108 46x40 ar=0.87 holes=0 best=0:0.90 L=W:0.87 D=0:0.90 D2=0.89
- box=4 x=117.1 y=291.1 w=32.9 h=13.3 score=0.703 tilt=- crop=1 ink=true read=/0.0 glyphs=x=257 46x40 ar=0.87 holes=0 best=0:0.89 L=W:0.87 D=0:0.89 D2=0.88
- box=5 x=303.8 y=288.4 w=9.8 h=19.6 score=0.661 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=303.8 y=288.4 w=9.8 h=19.6 score=0.661 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=102.9 y=324.9 w=156.4 h=46.2 score=0.632 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=102.9 y=324.9 w=156.4 h=46.2 score=0.632 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=7 x=248.7 y=317.8 w=92.4 h=21.3 score=0.525 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=7 x=248.7 y=317.8 w=92.4 h=21.3 score=0.525 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-238 esperado=TUN10
- box=0 x=143.8 y=341.8 w=92.4 h=29.3 score=0.785 tilt=-0.6 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=143.8 y=341.8 w=92.4 h=29.3 score=0.785 tilt=-0.6 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=228.2 y=275.1 w=81.8 h=45.3 score=0.752 tilt=9.7 crop=0 ink=true read=TUI XX/0.0 glyphs=x=84 9x23 ar=2.56 holes=0 best=T:0.76 L=T:0.76 D=1:0.69 D2=0.68 | x=95 15x25 ar=1.67 holes=0 best=U:0.79 L=U:0.79 D=6:0.70 D2=0.69 | x=121 5x12 ar=2.40 holes=0 best=I:0.68 L=I:0.68 D=1:0.63 D2=0.60 | x=137 12x25 ar=2.08 holes=0 best=1:0.88 L=J:0.81 D=1:0.88 D2=0.79 | x=153 19x24 ar=1.26 holes=1 best=Q:0.94 L=Q:0.94 D=0:0.93 D2=0.90
- box=1 x=228.2 y=275.1 w=81.8 h=45.3 score=0.752 tilt=9.7 crop=1 ink=true read=QTNQ X/0.0 glyphs=x=92 19x24 ar=1.26 holes=1 best=Q:0.94 L=Q:0.94 D=0:0.93 D2=0.91 | x=115 12x25 ar=2.08 holes=0 best=T:0.84 L=T:0.84 D=1:0.75 D2=0.71 | x=138 5x12 ar=2.40 holes=0 best=N:0.68 L=N:0.68 D=1:0.61 D2=0.57 | x=154 15x25 ar=1.67 holes=0 best=Q:0.77 L=Q:0.77 D=7:0.73 D2=0.70 | x=171 9x23 ar=2.56 holes=0 best=1:0.77 L=I:0.74 D=1:0.77 D2=0.71
- box=2 x=142.9 y=298.2 w=27.6 h=10.7 score=0.676 tilt=- crop=0 ink=true read=/0.0 glyphs=x=82 32x29 ar=0.91 holes=0 best=0:0.89 L=W:0.87 D=0:0.89 D2=0.85
- box=2 x=142.9 y=298.2 w=27.6 h=10.7 score=0.676 tilt=- crop=1 ink=true read=/0.0 glyphs=x=161 32x29 ar=0.91 holes=0 best=0:0.87 L=N:0.86 D=0:0.87 D2=0.86
- box=3 x=284.2 y=324.0 w=22.2 h=47.1 score=0.573 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=284.2 y=324.0 w=22.2 h=47.1 score=0.573 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=174.0 y=299.1 w=43.6 h=9.8 score=0.417 tilt=- crop=0 ink=true read=/0.0 glyphs=x=167 25x24 ar=0.96 holes=0 best=0:0.94 L=W:0.87 D=0:0.94 D2=0.93
- box=4 x=174.0 y=299.1 w=43.6 h=9.8 score=0.417 tilt=- crop=1 ink=true read=/0.0 glyphs=x=251 25x24 ar=0.96 holes=0 best=0:0.93 L=W:0.86 D=0:0.93 D2=0.92
### pixel-live-20260617-090351__frame-242 esperado=MEX15
- box=0 x=235.3 y=267.1 w=86.2 h=33.8 score=0.939 tilt=3.6 crop=0 ink=true read=NO XX/0.0 glyphs=x=124 11x24 ar=2.18 holes=0 best=N:0.89 L=N:0.89 D=1:0.84 D2=0.82 | x=135 10x14 ar=1.40 holes=0 best=0:0.81 L=Q:0.79 D=0:0.81 D2=0.79 | x=148 14x20 ar=1.43 holes=0 best=8:0.93 L=R:0.88 D=8:0.93 D2=0.90 | x=192 21x37 ar=1.76 holes=0 best=X:0.85 L=X:0.85 D=1:0.80 D2=0.66
- box=0 x=235.3 y=267.1 w=86.2 h=33.8 score=0.939 tilt=3.6 crop=1 ink=true read=XB XX/0.0 glyphs=x=229 21x37 ar=1.76 holes=0 best=X:0.81 L=X:0.81 D=1:0.81 D2=0.69 | x=280 14x20 ar=1.43 holes=0 best=8:0.88 L=W:0.88 D=8:0.88 D2=0.87 | x=297 10x14 ar=1.40 holes=0 best=0:0.84 L=W:0.77 D=0:0.84 D2=0.81 | x=307 11x24 ar=2.18 holes=0 best=4:0.86 L=M:0.86 D=4:0.86 D2=0.85
- box=1 x=311.8 y=326.7 w=6.2 h=24.9 score=0.681 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=311.8 y=326.7 w=6.2 h=24.9 score=0.681 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=95.8 y=294.7 w=24.0 h=76.4 score=0.647 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=95.8 y=294.7 w=24.0 h=76.4 score=0.647 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=146.4 y=287.6 w=26.7 h=8.9 score=0.591 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=146.4 y=287.6 w=26.7 h=8.9 score=0.591 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=121.6 y=272.4 w=106.7 h=40.0 score=0.550 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=121.6 y=272.4 w=106.7 h=40.0 score=0.550 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=351.8 y=293.8 w=42.7 h=8.9 score=0.465 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=351.8 y=293.8 w=42.7 h=8.9 score=0.465 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-244 esperado=MEX15
- box=0 x=225.6 y=255.6 w=87.1 h=37.3 score=0.953 tilt=2.3 crop=0 ink=true read=MIPEX XX/0.0 glyphs=x=116 9x31 ar=3.44 holes=0 best=M:0.75 L=M:0.75 D=1:0.66 D2=0.54 | x=128 7x13 ar=1.86 holes=0 best=I:0.72 L=I:0.72 D=5:0.69 D2=0.67 | x=138 9x13 ar=1.44 holes=0 best=P:0.70 L=P:0.70 D=8:0.68 D2=0.68 | x=154 12x34 ar=2.83 holes=0 best=E:0.69 L=E:0.69 D=1:0.59 D2=0.59 | x=180 11x20 ar=1.82 holes=0 best=X:0.85 L=X:0.85 D=4:0.76 D2=0.73 | x=215 18x36 ar=2.00 holes=0 best=1:0.94 L=I:0.89 D=1:0.94 D2=0.81 | x=238 28x36 ar=1.29 holes=0 best=5:0.95 L=S:0.89 D=5:0.95 D2=0.88
- box=0 x=225.6 y=255.6 w=87.1 h=37.3 score=0.953 tilt=2.3 crop=1 ink=true read=EIXJBII/0.0 glyphs=x=139 28x36 ar=1.29 holes=0 best=E:0.90 L=E:0.90 D=9:0.86 D2=0.84 | x=172 18x36 ar=2.00 holes=0 best=I:0.91 L=I:0.91 D=1:0.86 D2=0.70 | x=214 11x20 ar=1.82 holes=0 best=X:0.88 L=X:0.88 D=1:0.77 D2=0.76 | x=239 12x34 ar=2.83 holes=0 best=J:0.73 L=J:0.73 D=1:0.71 D2=0.68 | x=258 9x13 ar=1.44 holes=0 best=8:0.69 L=W:0.68 D=8:0.69 D2=0.68 | x=270 7x13 ar=1.86 holes=0 best=I:0.71 L=I:0.71 D=5:0.69 D2=0.69 | x=280 9x31 ar=3.44 holes=0 best=I:0.75 L=I:0.75 D=1:0.72 D2=0.66
- box=1 x=287.8 y=298.2 w=14.2 h=40.0 score=0.826 tilt=- crop=0 ink=false read=/0.0 glyphs=x=428 9x24 ar=2.67 holes=0 best=U:0.85 L=U:0.85 D=1:0.82 D2=0.74
- box=1 x=287.8 y=298.2 w=14.2 h=40.0 score=0.826 tilt=- crop=1 ink=false read=/0.0 glyphs=x=35 9x24 ar=2.67 holes=0 best=1:0.78 L=M:0.78 D=1:0.78 D2=0.65
- box=2 x=271.8 y=297.3 w=31.1 h=73.8 score=0.792 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=271.8 y=297.3 w=31.1 h=73.8 score=0.792 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=150.0 y=266.2 w=23.1 h=9.8 score=0.759 tilt=- crop=0 ink=true read=/0.0 glyphs=x=103 51x41 ar=0.80 holes=0 best=0:0.91 L=W:0.88 D=0:0.91 D2=0.88
- box=3 x=150.0 y=266.2 w=23.1 h=9.8 score=0.759 tilt=- crop=1 ink=true read=/0.0 glyphs=x=244 51x41 ar=0.80 holes=0 best=0:0.89 L=N:0.86 D=0:0.89 D2=0.87
- box=4 x=86.0 y=363.1 w=31.1 h=8.0 score=0.523 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=363.1 w=31.1 h=8.0 score=0.523 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=310.0 y=343.6 w=8.9 h=27.6 score=0.460 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=310.0 y=343.6 w=8.9 h=27.6 score=0.460 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=86.0 y=233.3 w=34.7 h=9.8 score=0.450 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=86.0 y=233.3 w=34.7 h=9.8 score=0.450 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-246 esperado=MEX15
- box=0 x=147.3 y=264.4 w=23.1 h=8.0 score=0.823 tilt=2.7 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=147.3 y=264.4 w=23.1 h=8.0 score=0.823 tilt=2.7 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=223.8 y=262.7 w=79.1 h=28.4 score=0.660 tilt=- crop=0 ink=true read=/0.0 glyphs=
- box=1 x=223.8 y=262.7 w=79.1 h=28.4 score=0.660 tilt=- crop=1 ink=true read=/0.0 glyphs=
- box=2 x=104.7 y=262.7 w=30.2 h=8.0 score=0.580 tilt=- crop=0 ink=false read=/0.0 glyphs=x=169 16x15 ar=0.94 holes=0 best=0:0.89 L=W:0.87 D=0:0.89 D2=0.89
- box=2 x=104.7 y=262.7 w=30.2 h=8.0 score=0.580 tilt=- crop=1 ink=false read=/0.0 glyphs=x=214 16x15 ar=0.94 holes=0 best=0:0.89 L=W:0.88 D=0:0.89 D2=0.87
### pixel-live-20260617-090351__frame-247 esperado=MEX15
- box=0 x=147.3 y=356.9 w=38.2 h=14.2 score=0.931 tilt=7.2 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=147.3 y=356.9 w=38.2 h=14.2 score=0.931 tilt=7.2 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=158.0 y=246.7 w=23.1 h=8.9 score=0.872 tilt=2.4 crop=0 ink=false read=/0.0 glyphs=
- box=1 x=158.0 y=246.7 w=23.1 h=8.9 score=0.872 tilt=2.4 crop=1 ink=false read=/0.0 glyphs=
- box=2 x=237.1 y=244.0 w=80.9 h=28.4 score=0.689 tilt=- crop=0 ink=true read=/0.0 glyphs=x=110 3x4 ar=1.33 holes=0 best=F:0.27 L=F:0.27 D=8:0.23 D2=0.22
- box=2 x=237.1 y=244.0 w=80.9 h=28.4 score=0.689 tilt=- crop=1 ink=true read=/0.0 glyphs=x=192 3x4 ar=1.33 holes=0 best=4:0.29 L=X:0.27 D=4:0.29 D2=0.26
- box=3 x=112.7 y=244.9 w=31.1 h=8.9 score=0.548 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=112.7 y=244.9 w=31.1 h=8.9 score=0.548 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-253 esperado=MEX19
- box=0 x=86.0 y=253.8 w=31.1 h=12.4 score=0.873 tilt=-2.9 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=253.8 w=31.1 h=12.4 score=0.873 tilt=-2.9 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=102.9 y=338.2 w=82.7 h=32.9 score=0.840 tilt=-4.8 crop=0 ink=false read=/0.0 glyphs=
- box=1 x=102.9 y=338.2 w=82.7 h=32.9 score=0.840 tilt=-4.8 crop=1 ink=false read=/0.0 glyphs=
- box=2 x=171.3 y=275.1 w=99.6 h=36.4 score=0.771 tilt=- crop=0 ink=true read=BME XX/0.0 glyphs=x=82 8x14 ar=1.75 holes=0 best=8:0.76 L=M:0.74 D=8:0.76 D2=0.74 | x=93 6x13 ar=2.17 holes=0 best=M:0.75 L=M:0.75 D=4:0.68 D2=0.67 | x=99 22x32 ar=1.45 holes=0 best=E:0.75 L=E:0.75 D=5:0.70 D2=0.67 | x=132 9x18 ar=2.00 holes=0 best=1:0.91 L=M:0.89 D=1:0.91 D2=0.90 | x=142 4x5 ar=1.25 holes=0 best=N:0.30 L=N:0.30 D=4:0.30 D2=0.29
- box=2 x=171.3 y=275.1 w=99.6 h=36.4 score=0.771 tilt=- crop=1 ink=true read=EIW XX/0.0 glyphs=x=147 4x5 ar=1.25 holes=0 best=E:0.31 L=E:0.31 D=1:0.27 D2=0.26 | x=152 9x18 ar=2.00 holes=0 best=1:0.90 L=M:0.89 D=1:0.90 D2=0.88 | x=172 22x32 ar=1.45 holes=0 best=W:0.72 L=W:0.72 D=5:0.70 D2=0.67 | x=194 6x13 ar=2.17 holes=0 best=1:0.74 L=M:0.70 D=1:0.74 D2=0.69 | x=203 8x14 ar=1.75 holes=0 best=M:0.78 L=M:0.78 D=8:0.76 D2=0.75
- box=3 x=86.0 y=291.1 w=33.8 h=11.6 score=0.694 tilt=- crop=0 ink=true read=/0.0 glyphs=x=255 36x36 ar=1.00 holes=0 best=0:0.91 L=E:0.88 D=0:0.91 D2=0.90
- box=3 x=86.0 y=291.1 w=33.8 h=11.6 score=0.694 tilt=- crop=1 ink=true read=/0.0 glyphs=x=201 36x36 ar=1.00 holes=0 best=0:0.95 L=W:0.87 D=0:0.95 D2=0.92
### pixel-live-20260617-090351__frame-263 esperado=QAT17
- box=0 x=201.6 y=240.4 w=87.1 h=35.6 score=0.929 tilt=6.2 crop=0 ink=true read=/0.0 glyphs=x=112 6x2 ar=0.33 holes=0 best=E:0.21 L=E:0.21 D=0:0.19 D2=0.19
- box=0 x=201.6 y=240.4 w=87.1 h=35.6 score=0.929 tilt=6.2 crop=1 ink=true read=/0.0 glyphs=x=303 6x2 ar=0.33 holes=0 best=M:0.23 L=M:0.23 D=9:0.21 D2=0.20
- box=1 x=269.1 y=277.8 w=18.7 h=80.0 score=0.715 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=269.1 y=277.8 w=18.7 h=80.0 score=0.715 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=105.6 y=297.3 w=20.4 h=73.8 score=0.552 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=105.6 y=297.3 w=20.4 h=73.8 score=0.552 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-265 esperado=QAT17
- box=0 x=145.6 y=277.8 w=80.9 h=28.4 score=0.934 tilt=1.8 crop=0 ink=true read=OAT XX/0.0 glyphs=x=153 36x52 ar=1.44 holes=1 best=0:0.89 L=Q:0.87 D=0:0.89 D2=0.85 | x=189 38x52 ar=1.37 holes=1 best=A:0.95 L=A:0.95 D=8:0.85 D2=0.85 | x=221 32x52 ar=1.63 holes=0 best=T:0.91 L=T:0.91 D=1:0.85 D2=0.80 | x=272 30x52 ar=1.73 holes=0 best=1:0.96 L=X:0.85 D=1:0.96 D2=0.86 | x=302 37x51 ar=1.38 holes=0 best=7:0.89 L=Z:0.80 D=7:0.89 D2=0.85
- box=0 x=145.6 y=277.8 w=80.9 h=28.4 score=0.934 tilt=1.8 crop=1 ink=true read=CIGEJ/85.0 glyphs=x=148 36x51 ar=1.42 holes=0 best=C:0.81 L=C:0.81 D=2:0.81 D2=0.81 | x=184 31x52 ar=1.68 holes=0 best=1:0.90 L=X:0.86 D=1:0.90 D2=0.84 | x=234 32x52 ar=1.63 holes=0 best=G:0.90 L=G:0.90 D=1:0.88 D2=0.72 | x=260 59x53 ar=0.90 holes=1 best=E:0.85 L=E:0.85 D=8:0.82 D2=0.82 | x=319 15x49 ar=3.27 holes=0 best=J:0.79 L=J:0.79 D=1:0.75 D2=0.72
- box=1 x=208.7 y=310.7 w=18.7 h=60.4 score=0.862 tilt=-83.7 crop=0 ink=false read=/0.0 glyphs=
- box=1 x=208.7 y=310.7 w=18.7 h=60.4 score=0.862 tilt=-83.7 crop=1 ink=false read=/0.0 glyphs=
- box=2 x=95.8 y=281.3 w=42.7 h=17.8 score=0.764 tilt=- crop=0 ink=false read=XX/0.0 glyphs=x=23 12x12 ar=1.00 holes=0 best=8:0.70 L=W:0.67 D=8:0.70 D2=0.68 | x=154 16x14 ar=0.88 holes=0 best=W:0.86 L=W:0.86 D=8:0.85 D2=0.82
- box=2 x=95.8 y=281.3 w=42.7 h=17.8 score=0.764 tilt=- crop=1 ink=false read=W X/0.0 glyphs=x=240 16x14 ar=0.88 holes=0 best=W:0.87 L=W:0.87 D=8:0.85 D2=0.85 | x=375 12x12 ar=1.00 holes=0 best=8:0.68 L=E:0.65 D=8:0.68 D2=0.66
- box=3 x=86.0 y=257.3 w=31.1 h=10.7 score=0.694 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=257.3 w=31.1 h=10.7 score=0.694 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=218.4 y=318.7 w=8.0 h=27.6 score=0.685 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=218.4 y=318.7 w=8.0 h=27.6 score=0.685 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-270 esperado=QAT17
- box=0 x=343.8 y=301.8 w=28.4 h=69.3 score=0.679 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=343.8 y=301.8 w=28.4 h=69.3 score=0.679 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=315.3 y=300.0 w=30.2 h=16.0 score=0.624 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=315.3 y=300.0 w=30.2 h=16.0 score=0.624 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=370.4 y=293.8 w=24.0 h=77.3 score=0.431 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=370.4 y=293.8 w=24.0 h=77.3 score=0.431 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-272 esperado=QAT17
- box=0 x=297.6 y=290.2 w=20.4 h=76.4 score=0.676 tilt=-89.1 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=297.6 y=290.2 w=20.4 h=76.4 score=0.676 tilt=-89.1 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=201.6 y=247.6 w=136.0 h=37.3 score=0.671 tilt=3.7 crop=0 ink=false read=/0.0 glyphs=x=226 4x12 ar=3.00 holes=0 best=J:0.59 L=J:0.59 D=1:0.57 D2=0.52
- box=1 x=201.6 y=247.6 w=136.0 h=37.3 score=0.671 tilt=3.7 crop=1 ink=false read=/0.0 glyphs=x=150 4x12 ar=3.00 holes=0 best=F:0.56 L=F:0.56 D=8:0.47 D2=0.46
- box=2 x=329.6 y=346.2 w=7.1 h=24.9 score=0.558 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=329.6 y=346.2 w=7.1 h=24.9 score=0.558 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=152.7 y=269.8 w=30.2 h=8.0 score=0.456 tilt=- crop=0 ink=false read=/0.0 glyphs=x=147 14x19 ar=1.36 holes=0 best=8:0.91 L=W:0.88 D=8:0.91 D2=0.89
- box=3 x=152.7 y=269.8 w=30.2 h=8.0 score=0.456 tilt=- crop=1 ink=false read=/0.0 glyphs=x=238 14x19 ar=1.36 holes=0 best=W:0.91 L=W:0.91 D=8:0.89 D2=0.87
### pixel-live-20260617-090351__frame-274 esperado=QAT17
- box=0 x=218.4 y=244.9 w=99.6 h=36.4 score=0.832 tilt=4.7 crop=0 ink=true read=DAT XX/0.0 glyphs=x=138 23x25 ar=1.09 holes=0 best=D:0.64 L=D:0.64 D=0:0.61 D2=0.58 | x=165 26x35 ar=1.35 holes=0 best=A:0.91 L=A:0.91 D=4:0.83 D2=0.79 | x=195 17x37 ar=2.18 holes=0 best=T:0.94 L=T:0.94 D=1:0.80 D2=0.72 | x=234 24x38 ar=1.58 holes=0 best=1:0.97 L=G:0.90 D=1:0.97 D2=0.82 | x=262 23x35 ar=1.52 holes=0 best=7:0.94 L=Z:0.75 D=7:0.94 D2=0.79
- box=0 x=218.4 y=244.9 w=99.6 h=36.4 score=0.832 tilt=4.7 crop=1 ink=true read=ETGVU/85.6 glyphs=x=182 23x35 ar=1.52 holes=0 best=E:0.79 L=E:0.79 D=8:0.74 D2=0.73 | x=209 24x38 ar=1.58 holes=0 best=T:0.92 L=T:0.92 D=1:0.89 D2=0.76 | x=255 17x37 ar=2.18 holes=0 best=G:0.90 L=G:0.90 D=1:0.89 D2=0.75 | x=276 26x35 ar=1.35 holes=0 best=4:0.93 L=V:0.93 D=4:0.93 D2=0.80 | x=306 23x25 ar=1.09 holes=0 best=U:0.74 L=U:0.74 D=0:0.60 D2=0.59
- box=1 x=141.1 y=257.3 w=24.0 h=8.9 score=0.812 tilt=1.7 crop=0 ink=true read=ON/90.2 glyphs=x=126 47x42 ar=0.89 holes=0 best=0:0.89 L=W:0.88 D=0:0.89 D2=0.86 | x=216 21x44 ar=2.10 holes=0 best=N:0.91 L=N:0.91 D=1:0.87 D2=0.82
- box=1 x=141.1 y=257.3 w=24.0 h=8.9 score=0.812 tilt=1.7 crop=1 ink=true read=NN/88.0 glyphs=x=201 21x44 ar=2.10 holes=0 best=N:0.89 L=N:0.89 D=1:0.85 D2=0.83 | x=265 47x42 ar=0.89 holes=0 best=N:0.87 L=N:0.87 D=0:0.87 D2=0.87
- box=2 x=133.1 y=321.3 w=16.9 h=39.1 score=0.805 tilt=84.3 crop=0 ink=false read=/0.0 glyphs=
- box=2 x=133.1 y=321.3 w=16.9 h=39.1 score=0.805 tilt=84.3 crop=1 ink=false read=/0.0 glyphs=
- box=3 x=166.9 y=251.1 w=44.4 h=17.8 score=0.757 tilt=- crop=0 ink=false read=/0.0 glyphs=x=164 17x17 ar=1.00 holes=0 best=0:0.92 L=W:0.86 D=0:0.92 D2=0.91
- box=3 x=166.9 y=251.1 w=44.4 h=17.8 score=0.757 tilt=- crop=1 ink=false read=/0.0 glyphs=x=241 17x17 ar=1.00 holes=0 best=0:0.93 L=B:0.86 D=0:0.93 D2=0.91
- box=4 x=254.0 y=279.6 w=39.1 h=16.9 score=0.612 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=254.0 y=279.6 w=39.1 h=16.9 score=0.612 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=224.4 w=36.4 h=11.6 score=0.535 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=224.4 w=36.4 h=11.6 score=0.535 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=286.9 y=286.7 w=16.9 h=77.3 score=0.486 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=286.9 y=286.7 w=16.9 h=77.3 score=0.486 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-275 esperado=QAT17
- box=0 x=143.8 y=322.2 w=17.8 h=39.1 score=0.815 tilt=82.9 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=143.8 y=322.2 w=17.8 h=39.1 score=0.815 tilt=82.9 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=350.0 y=293.8 w=44.4 h=16.9 score=0.806 tilt=-7.4 crop=0 ink=false read=EEEN X/0.0 glyphs=x=288 6x2 ar=0.33 holes=0 best=E:0.25 L=E:0.25 D=9:0.25 D2=0.24 | x=294 6x2 ar=0.33 holes=0 best=E:0.20 L=E:0.20 D=0:0.18 D2=0.16 | x=300 5x2 ar=0.40 holes=0 best=E:0.28 L=E:0.28 D=9:0.25 D2=0.25 | x=305 4x3 ar=0.75 holes=0 best=N:0.25 L=N:0.25 D=0:0.23 D2=0.23 | x=309 13x5 ar=0.38 holes=0 best=E:0.50 L=E:0.50 D=0:0.46 D2=0.44
- box=1 x=350.0 y=293.8 w=44.4 h=16.9 score=0.806 tilt=-7.4 crop=1 ink=false read=WMEE X/0.0 glyphs=x=134 6x5 ar=0.83 holes=0 best=W:0.35 L=W:0.35 D=0:0.34 D2=0.34 | x=140 6x5 ar=0.83 holes=0 best=M:0.35 L=M:0.35 D=0:0.33 D2=0.32 | x=146 5x3 ar=0.60 holes=0 best=E:0.32 L=E:0.32 D=0:0.28 D2=0.27 | x=151 5x2 ar=0.40 holes=0 best=E:0.27 L=E:0.27 D=0:0.22 D2=0.22 | x=156 12x2 ar=0.17 holes=0 best=E:0.35 L=E:0.35 D=6:0.31 D2=0.30
- box=2 x=86.0 y=241.3 w=50.7 h=16.0 score=0.734 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=86.0 y=241.3 w=50.7 h=16.0 score=0.734 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=150.9 y=261.8 w=23.1 h=8.9 score=0.727 tilt=- crop=0 ink=true read=OI/87.1 glyphs=x=125 40x39 ar=0.98 holes=0 best=0:0.89 L=W:0.87 D=0:0.89 D2=0.88 | x=215 9x27 ar=3.00 holes=0 best=I:0.85 L=I:0.85 D=1:0.77 D2=0.67
- box=3 x=150.9 y=261.8 w=23.1 h=8.9 score=0.727 tilt=- crop=1 ink=true read=M X/0.0 glyphs=x=202 9x27 ar=3.00 holes=0 best=M:0.88 L=M:0.88 D=1:0.80 D2=0.67 | x=261 40x39 ar=0.98 holes=0 best=8:0.90 L=E:0.84 D=8:0.90 D2=0.89
- box=4 x=259.3 y=283.1 w=39.1 h=17.8 score=0.593 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=259.3 y=283.1 w=39.1 h=17.8 score=0.593 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=228.0 w=37.3 h=11.6 score=0.529 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=228.0 w=37.3 h=11.6 score=0.529 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=175.8 y=250.2 w=146.7 h=36.4 score=0.520 tilt=- crop=0 ink=true read=DAT XX/0.0 glyphs=x=199 14x13 ar=0.93 holes=0 best=D:0.55 L=D:0.55 D=0:0.47 D2=0.45 | x=216 14x20 ar=1.43 holes=1 best=A:0.88 L=A:0.88 D=4:0.80 D2=0.75 | x=233 8x21 ar=2.63 holes=0 best=T:0.90 L=T:0.90 D=1:0.81 D2=0.70 | x=256 15x22 ar=1.47 holes=0 best=1:0.88 L=G:0.84 D=1:0.88 D2=0.71 | x=271 13x21 ar=1.62 holes=0 best=7:0.88 L=V:0.70 D=7:0.88 D2=0.76
- box=6 x=175.8 y=250.2 w=146.7 h=36.4 score=0.520 tilt=- crop=1 ink=true read=CTGVU/0.0 glyphs=x=132 13x21 ar=1.62 holes=0 best=C:0.80 L=C:0.80 D=6:0.71 D2=0.67 | x=145 15x22 ar=1.47 holes=0 best=T:0.89 L=T:0.89 D=1:0.87 D2=0.76 | x=175 8x21 ar=2.63 holes=0 best=G:0.89 L=G:0.89 D=1:0.81 D2=0.64 | x=186 14x20 ar=1.43 holes=1 best=4:0.89 L=V:0.89 D=4:0.89 D2=0.77 | x=203 14x13 ar=0.93 holes=0 best=U:0.59 L=U:0.59 D=0:0.45 D2=0.44
### pixel-live-20260617-090351__frame-283 esperado=IRN10
- box=0 x=212.2 y=271.6 w=84.4 h=39.1 score=0.990 tilt=0.8 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=212.2 y=271.6 w=84.4 h=39.1 score=0.990 tilt=0.8 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=139.3 y=274.2 w=23.1 h=9.8 score=0.831 tilt=- crop=0 ink=true read=/0.0 glyphs=x=103 49x44 ar=0.90 holes=0 best=0:0.88 L=N:0.87 D=0:0.88 D2=0.86
- box=1 x=139.3 y=274.2 w=23.1 h=9.8 score=0.831 tilt=- crop=1 ink=true read=/0.0 glyphs=x=246 49x44 ar=0.90 holes=0 best=8:0.87 L=E:0.84 D=8:0.87 D2=0.86
- box=2 x=262.0 y=309.8 w=19.6 h=61.3 score=0.654 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=262.0 y=309.8 w=19.6 h=61.3 score=0.654 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=165.1 y=276.9 w=38.2 h=11.6 score=0.412 tilt=- crop=0 ink=true read=/0.0 glyphs=x=136 17x20 ar=1.18 holes=0 best=8:0.94 L=W:0.88 D=8:0.94 D2=0.92
- box=3 x=165.1 y=276.9 w=38.2 h=11.6 score=0.412 tilt=- crop=1 ink=true read=/0.0 glyphs=x=191 17x20 ar=1.18 holes=0 best=8:0.92 L=W:0.91 D=8:0.92 D2=0.91
### pixel-live-20260617-090351__frame-290 esperado=IRN15
- box=0 x=113.6 y=318.7 w=15.1 h=28.4 score=0.926 tilt=-84.4 crop=0 ink=true read=/0.0 glyphs=
- box=0 x=113.6 y=318.7 w=15.1 h=28.4 score=0.926 tilt=-84.4 crop=1 ink=true read=/0.0 glyphs=
- box=1 x=186.4 y=329.3 w=78.2 h=41.8 score=0.747 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=186.4 y=329.3 w=78.2 h=41.8 score=0.747 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=304.7 y=316.9 w=20.4 h=54.2 score=0.702 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=304.7 y=316.9 w=20.4 h=54.2 score=0.702 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=187.3 y=290.2 w=23.1 h=9.8 score=0.682 tilt=- crop=0 ink=true read=/0.0 glyphs=x=98 52x47 ar=0.90 holes=0 best=0:0.89 L=W:0.87 D=0:0.89 D2=0.85
- box=3 x=187.3 y=290.2 w=23.1 h=9.8 score=0.682 tilt=- crop=1 ink=true read=/0.0 glyphs=x=248 52x47 ar=0.90 holes=0 best=0:0.87 L=N:0.86 D=0:0.87 D2=0.86
- box=4 x=95.8 y=260.0 w=25.8 h=13.3 score=0.625 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=95.8 y=260.0 w=25.8 h=13.3 score=0.625 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-291 esperado=IRN15
- box=0 x=134.9 y=321.3 w=23.1 h=49.8 score=0.756 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=134.9 y=321.3 w=23.1 h=49.8 score=0.756 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=222.0 y=261.8 w=78.2 h=24.0 score=0.601 tilt=- crop=0 ink=true read=IMN XXX/0.0 glyphs=x=107 6x32 ar=5.33 holes=0 best=I:0.80 L=I:0.80 D=1:0.74 D2=0.61 | x=118 9x20 ar=2.22 holes=0 best=M:0.83 L=M:0.83 D=1:0.69 D2=0.60 | x=146 9x20 ar=2.22 holes=0 best=N:0.87 L=N:0.87 D=1:0.74 D2=0.72 | x=159 8x14 ar=1.75 holes=0 best=4:0.78 L=A:0.69 D=4:0.78 D2=0.74 | x=188 18x33 ar=1.83 holes=0 best=1:0.96 L=I:0.90 D=1:0.96 D2=0.81 | x=214 28x35 ar=1.25 holes=0 best=5:0.88 L=S:0.87 D=5:0.88 D2=0.84
- box=1 x=222.0 y=261.8 w=78.2 h=24.0 score=0.601 tilt=- crop=1 ink=true read=ETPIUI/83.2 glyphs=x=101 28x35 ar=1.25 holes=0 best=E:0.86 L=E:0.86 D=9:0.85 D2=0.83 | x=137 18x33 ar=1.83 holes=0 best=T:0.89 L=T:0.89 D=1:0.88 D2=0.72 | x=176 8x14 ar=1.75 holes=0 best=P:0.79 L=P:0.79 D=8:0.71 D2=0.69 | x=188 9x20 ar=2.22 holes=0 best=1:0.81 L=J:0.80 D=1:0.81 D2=0.81 | x=216 9x20 ar=2.22 holes=0 best=U:0.79 L=U:0.79 D=1:0.71 D2=0.67 | x=230 6x32 ar=5.33 holes=0 best=I:0.84 L=I:0.84 D=1:0.70 D2=0.55
- box=2 x=111.8 y=275.1 w=35.6 h=10.7 score=0.492 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=111.8 y=275.1 w=35.6 h=10.7 score=0.492 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-298 esperado=BIH12
- box=0 x=209.6 y=273.3 w=96.0 h=31.1 score=0.944 tilt=0.5 crop=0 ink=true read=SO XXX/0.0 glyphs=x=161 19x54 ar=2.84 holes=0 best=S:0.90 L=S:0.90 D=1:0.78 D2=0.69 | x=180 52x54 ar=1.04 holes=2 best=0:0.87 L=W:0.86 D=0:0.87 D2=0.84 | x=232 20x48 ar=2.40 holes=0 best=4:0.79 L=J:0.73 D=4:0.79 D2=0.77 | x=281 35x56 ar=1.60 holes=0 best=1:0.99 L=G:0.87 D=1:0.99 D2=0.80 | x=316 46x57 ar=1.24 holes=0 best=2:0.96 L=Z:0.85 D=2:0.96 D2=0.85
- box=0 x=209.6 y=273.3 w=96.0 h=31.1 score=0.944 tilt=0.5 crop=1 ink=true read=BIE XX/0.0 glyphs=x=157 45x57 ar=1.27 holes=0 best=8:0.87 L=B:0.85 D=8:0.87 D2=0.86 | x=202 36x56 ar=1.56 holes=0 best=1:0.90 L=T:0.87 D=1:0.90 D2=0.82 | x=267 19x48 ar=2.53 holes=0 best=E:0.82 L=E:0.82 D=1:0.73 D2=0.68 | x=286 55x54 ar=0.98 holes=2 best=0:0.85 L=E:0.85 D=0:0.85 D2=0.85 | x=341 17x54 ar=3.18 holes=0 best=U:0.89 L=U:0.89 D=1:0.85 D2=0.71
- box=1 x=126.0 y=330.2 w=96.0 h=40.9 score=0.939 tilt=-2.9 crop=0 ink=true read=WINM X/0.0 glyphs=x=82 8x9 ar=1.13 holes=0 best=W:0.52 L=W:0.52 D=8:0.52 D2=0.51 | x=90 4x10 ar=2.50 holes=0 best=I:0.60 L=I:0.60 D=1:0.56 D2=0.54 | x=94 13x12 ar=0.92 holes=0 best=N:0.73 L=N:0.73 D=0:0.73 D2=0.73 | x=107 12x11 ar=0.92 holes=0 best=M:0.67 L=M:0.67 D=0:0.63 D2=0.60 | x=119 5x7 ar=1.40 holes=0 best=R:0.40 L=R:0.40 D=8:0.38 D2=0.37
- box=1 x=126.0 y=330.2 w=96.0 h=40.9 score=0.939 tilt=-2.9 crop=1 ink=true read=IIMORF/0.0 glyphs=x=282 4x7 ar=1.75 holes=0 best=1:0.44 L=J:0.43 D=1:0.44 D2=0.40 | x=286 4x8 ar=2.00 holes=0 best=1:0.49 L=F:0.47 D=1:0.49 D2=0.48 | x=290 5x10 ar=2.00 holes=0 best=M:0.58 L=M:0.58 D=1:0.56 D2=0.55 | x=295 13x12 ar=0.92 holes=0 best=0:0.74 L=N:0.73 D=0:0.74 D2=0.73 | x=308 12x11 ar=0.92 holes=0 best=R:0.70 L=R:0.70 D=0:0.67 D2=0.64 | x=320 4x8 ar=2.00 holes=0 best=F:0.48 L=F:0.48 D=8:0.43 D2=0.43
- box=2 x=230.9 y=284.0 w=24.9 h=13.3 score=0.827 tilt=- crop=0 ink=true read=/0.0 glyphs=x=87 24x78 ar=3.25 holes=0 best=1:0.75 L=I:0.74 D=1:0.75 D2=0.64
- box=2 x=230.9 y=284.0 w=24.9 h=13.3 score=0.827 tilt=- crop=1 ink=true read=/0.0 glyphs=x=207 24x78 ar=3.25 holes=0 best=1:0.73 L=I:0.71 D=1:0.73 D2=0.64
- box=3 x=125.1 y=287.6 w=24.9 h=10.7 score=0.726 tilt=- crop=0 ink=true read=/0.0 glyphs=x=107 50x45 ar=0.90 holes=0 best=0:0.92 L=W:0.88 D=0:0.92 D2=0.90
- box=3 x=125.1 y=287.6 w=24.9 h=10.7 score=0.726 tilt=- crop=1 ink=true read=/0.0 glyphs=x=238 50x45 ar=0.90 holes=0 best=0:0.90 L=N:0.86 D=0:0.90 D2=0.89
- box=4 x=86.0 y=257.3 w=31.1 h=10.7 score=0.674 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=257.3 w=31.1 h=10.7 score=0.674 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=288.4 w=37.3 h=11.6 score=0.561 tilt=- crop=0 ink=false read=/0.0 glyphs=x=107 11x15 ar=1.36 holes=0 best=Q:0.87 L=Q:0.87 D=0:0.85 D2=0.85
- box=5 x=86.0 y=288.4 w=37.3 h=11.6 score=0.561 tilt=- crop=1 ink=false read=/0.0 glyphs=x=220 11x15 ar=1.36 holes=0 best=8:0.87 L=M:0.87 D=8:0.87 D2=0.85
### pixel-live-20260617-090351__frame-302 esperado=BIH12
- box=0 x=217.6 y=289.3 w=76.4 h=27.6 score=0.948 tilt=0.8 crop=0 ink=true read=SW XXX/0.0 glyphs=x=156 19x54 ar=2.84 holes=0 best=S:0.92 L=S:0.92 D=1:0.78 D2=0.70 | x=175 43x53 ar=1.23 holes=2 best=W:0.88 L=W:0.88 D=0:0.85 D2=0.85 | x=218 21x47 ar=2.24 holes=0 best=4:0.75 L=R:0.69 D=4:0.75 D2=0.73 | x=263 32x53 ar=1.66 holes=0 best=1:0.96 L=G:0.89 D=1:0.96 D2=0.79 | x=295 38x53 ar=1.39 holes=0 best=2:0.96 L=Z:0.86 D=2:0.96 D2=0.83
- box=0 x=217.6 y=289.3 w=76.4 h=27.6 score=0.948 tilt=0.8 crop=1 ink=true read=BIF X/0.0 glyphs=x=137 37x53 ar=1.43 holes=0 best=8:0.86 L=Z:0.85 D=8:0.86 D2=0.82 | x=174 33x53 ar=1.61 holes=0 best=1:0.90 L=T:0.89 D=1:0.90 D2=0.76 | x=231 19x47 ar=2.47 holes=0 best=F:0.83 L=F:0.83 D=1:0.67 D2=0.65 | x=250 64x54 ar=0.84 holes=4 best=R:0.82 L=R:0.82 D=0:0.79 D2=0.76
- box=1 x=86.0 y=272.4 w=25.8 h=8.9 score=0.833 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=86.0 y=272.4 w=25.8 h=8.9 score=0.833 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=139.3 y=340.9 w=90.7 h=30.2 score=0.818 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=139.3 y=340.9 w=90.7 h=30.2 score=0.818 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=279.8 y=322.2 w=17.8 h=37.3 score=0.771 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=279.8 y=322.2 w=17.8 h=37.3 score=0.771 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=120.7 y=311.6 w=157.3 h=59.6 score=0.753 tilt=- crop=0 ink=false read=EEER X/0.0 glyphs=x=24 5x5 ar=1.00 holes=0 best=E:0.35 L=E:0.35 D=8:0.33 D2=0.32 | x=58 3x4 ar=1.33 holes=0 best=E:0.26 L=E:0.26 D=8:0.25 D2=0.25 | x=72 7x6 ar=0.86 holes=0 best=E:0.43 L=E:0.43 D=8:0.42 D2=0.41 | x=120 3x3 ar=1.00 holes=0 best=R:0.22 L=R:0.22 D=4:0.21 D2=0.20 | x=202 4x7 ar=1.75 holes=0 best=P:0.38 L=P:0.38 D=8:0.37 D2=0.37
- box=4 x=120.7 y=311.6 w=157.3 h=59.6 score=0.753 tilt=- crop=1 ink=false read=JRBAP/0.0 glyphs=x=80 4x7 ar=1.75 holes=0 best=J:0.40 L=J:0.40 D=4:0.38 D2=0.37 | x=163 3x3 ar=1.00 holes=0 best=R:0.22 L=R:0.22 D=4:0.21 D2=0.20 | x=207 7x6 ar=0.86 holes=0 best=8:0.42 L=E:0.41 D=8:0.42 D2=0.40 | x=225 3x4 ar=1.33 holes=0 best=A:0.28 L=A:0.28 D=8:0.27 D2=0.26 | x=257 5x5 ar=1.00 holes=0 best=P:0.33 L=P:0.33 D=8:0.29 D2=0.28
- box=5 x=135.8 y=300.9 w=26.7 h=11.6 score=0.661 tilt=- crop=0 ink=true read=/0.0 glyphs=x=73 30x25 ar=0.83 holes=0 best=0:0.91 L=W:0.89 D=0:0.91 D2=0.89
- box=5 x=135.8 y=300.9 w=26.7 h=11.6 score=0.661 tilt=- crop=1 ink=true read=/0.0 glyphs=x=151 30x25 ar=0.83 holes=0 best=0:0.89 L=E:0.87 D=0:0.89 D2=0.88
- box=6 x=164.2 y=292.9 w=46.2 h=18.7 score=0.644 tilt=- crop=0 ink=false read=/0.0 glyphs=x=107 9x10 ar=1.11 holes=0 best=W:0.59 L=W:0.59 D=8:0.58 D2=0.57
- box=6 x=164.2 y=292.9 w=46.2 h=18.7 score=0.644 tilt=- crop=1 ink=false read=/0.0 glyphs=x=149 9x10 ar=1.11 holes=0 best=8:0.58 L=W:0.57 D=8:0.58 D2=0.57
### pixel-live-20260617-090351__frame-304 esperado=BIH12
- box=0 x=180.2 y=269.8 w=108.4 h=39.1 score=0.870 tilt=4.5 crop=0 ink=true read=SO XXX/0.0 glyphs=x=151 18x47 ar=2.61 holes=0 best=S:0.88 L=S:0.88 D=1:0.79 D2=0.73 | x=169 47x48 ar=1.02 holes=1 best=0:0.87 L=W:0.86 D=0:0.87 D2=0.85 | x=216 19x41 ar=2.16 holes=0 best=4:0.80 L=U:0.78 D=4:0.80 D2=0.78 | x=259 29x49 ar=1.69 holes=0 best=1:0.97 L=I:0.85 D=1:0.97 D2=0.82 | x=288 43x50 ar=1.16 holes=0 best=2:0.95 L=Z:0.83 D=2:0.95 D2=0.83
- box=0 x=180.2 y=269.8 w=108.4 h=39.1 score=0.870 tilt=4.5 crop=1 ink=true read=BIE XX/0.0 glyphs=x=140 42x50 ar=1.19 holes=0 best=B:0.85 L=B:0.85 D=8:0.84 D2=0.82 | x=182 30x49 ar=1.63 holes=0 best=1:0.91 L=T:0.87 D=1:0.91 D2=0.77 | x=236 18x41 ar=2.28 holes=0 best=E:0.81 L=E:0.81 D=1:0.77 D2=0.69 | x=254 51x48 ar=0.94 holes=1 best=0:0.85 L=E:0.85 D=0:0.85 D2=0.84 | x=305 15x47 ar=3.13 holes=0 best=U:0.87 L=U:0.87 D=1:0.83 D2=0.72
- box=1 x=205.1 y=284.9 w=28.4 h=15.1 score=0.788 tilt=- crop=0 ink=true read=/0.0 glyphs=x=96 26x77 ar=2.96 holes=0 best=I:0.68 L=I:0.68 D=1:0.66 D2=0.58
- box=1 x=205.1 y=284.9 w=28.4 h=15.1 score=0.788 tilt=- crop=1 ink=true read=/0.0 glyphs=x=207 26x77 ar=2.96 holes=0 best=I:0.69 L=I:0.69 D=1:0.66 D2=0.55
- box=2 x=91.3 y=339.1 w=109.3 h=32.0 score=0.693 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=91.3 y=339.1 w=109.3 h=32.0 score=0.693 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=112.7 y=290.2 w=55.1 h=14.2 score=0.369 tilt=- crop=0 ink=false read=/0.0 glyphs=x=156 13x12 ar=0.92 holes=0 best=8:0.74 L=N:0.71 D=8:0.74 D2=0.72
- box=3 x=112.7 y=290.2 w=55.1 h=14.2 score=0.369 tilt=- crop=1 ink=false read=/0.0 glyphs=x=223 13x12 ar=0.92 holes=0 best=8:0.72 L=W:0.70 D=8:0.72 D2=0.71
### pixel-live-20260617-090351__frame-307 esperado=CUW4
- box=0 x=214.9 y=241.3 w=106.7 h=37.3 score=0.859 tilt=-3.2 crop=0 ink=true read=DXW 4/82.3 glyphs=x=154 47x50 ar=1.06 holes=1 best=D:0.72 L=D:0.72 D=0:0.66 D2=0.63 | x=201 30x48 ar=1.60 holes=0 best=X:0.76 L=X:0.76 D=7:0.75 D2=0.74 | x=227 42x48 ar=1.14 holes=0 best=W:0.86 L=W:0.86 D=4:0.79 D2=0.76 | x=293 43x50 ar=1.16 holes=0 best=4:0.95 L=G:0.82 D=4:0.95 D2=0.81
- box=0 x=214.9 y=241.3 w=106.7 h=37.3 score=0.859 tilt=-3.2 crop=1 ink=true read=EYIG/80.5 glyphs=x=154 43x50 ar=1.16 holes=0 best=E:0.94 L=E:0.94 D=8:0.81 D2=0.78 | x=221 42x48 ar=1.14 holes=0 best=Y:0.79 L=Y:0.79 D=0:0.76 D2=0.75 | x=259 29x48 ar=1.66 holes=0 best=1:0.76 L=Z:0.75 D=1:0.76 D2=0.73 | x=288 48x50 ar=1.04 holes=1 best=G:0.73 L=G:0.73 D=0:0.66 D2=0.66
- box=1 x=86.0 y=246.7 w=31.1 h=11.6 score=0.790 tilt=- crop=0 ink=true read=/0.0 glyphs=x=63 29x33 ar=1.14 holes=0 best=0:0.91 L=W:0.87 D=0:0.91 D2=0.91
- box=1 x=86.0 y=246.7 w=31.1 h=11.6 score=0.790 tilt=- crop=1 ink=true read=/0.0 glyphs=x=370 29x33 ar=1.14 holes=0 best=0:0.92 L=W:0.88 D=0:0.92 D2=0.92
- box=2 x=119.8 y=247.6 w=28.4 h=11.6 score=0.687 tilt=- crop=0 ink=true read=/0.0 glyphs=x=113 54x51 ar=0.94 holes=0 best=0:0.91 L=W:0.88 D=0:0.91 D2=0.89
- box=2 x=119.8 y=247.6 w=28.4 h=11.6 score=0.687 tilt=- crop=1 ink=true read=/0.0 glyphs=x=255 54x51 ar=0.94 holes=0 best=8:0.90 L=E:0.86 D=8:0.90 D2=0.89
- box=3 x=150.9 y=249.3 w=50.7 h=11.6 score=0.379 tilt=- crop=0 ink=true read=/0.0 glyphs=x=175 21x23 ar=1.10 holes=0 best=0:0.90 L=W:0.90 D=0:0.90 D2=0.89
- box=3 x=150.9 y=249.3 w=50.7 h=11.6 score=0.379 tilt=- crop=1 ink=true read=/0.0 glyphs=x=250 21x23 ar=1.10 holes=0 best=8:0.92 L=E:0.88 D=8:0.92 D2=0.90
### pixel-live-20260617-090351__frame-308 esperado=CUW4
- box=0 x=222.0 y=260.0 w=100.4 h=34.7 score=0.917 tilt=-3.2 crop=0 ink=true read=DAV 4/84.9 glyphs=x=156 47x51 ar=1.09 holes=0 best=D:0.77 L=D:0.77 D=0:0.70 D2=0.66 | x=203 37x47 ar=1.27 holes=0 best=A:0.85 L=A:0.85 D=5:0.80 D2=0.76 | x=240 30x48 ar=1.60 holes=0 best=V:0.82 L=V:0.82 D=4:0.78 D2=0.77 | x=293 43x51 ar=1.19 holes=0 best=4:0.97 L=G:0.81 D=4:0.97 D2=0.82
- box=0 x=222.0 y=260.0 w=100.4 h=34.7 score=0.917 tilt=-3.2 crop=1 ink=true read=EAV X/0.0 glyphs=x=153 43x51 ar=1.19 holes=0 best=E:0.94 L=E:0.94 D=8:0.80 D2=0.78 | x=219 29x48 ar=1.66 holes=0 best=4:0.84 L=A:0.82 D=4:0.84 D2=0.79 | x=248 35x47 ar=1.34 holes=0 best=V:0.91 L=V:0.91 D=4:0.87 D2=0.79 | x=283 50x51 ar=1.02 holes=0 best=G:0.69 L=G:0.69 D=0:0.68 D2=0.66
- box=1 x=239.8 y=292.0 w=63.1 h=22.2 score=0.739 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=239.8 y=292.0 w=63.1 h=22.2 score=0.739 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=133.1 y=265.3 w=27.6 h=10.7 score=0.654 tilt=- crop=0 ink=true read=/0.0 glyphs=x=76 30x28 ar=0.93 holes=0 best=0:0.91 L=W:0.90 D=0:0.91 D2=0.90
- box=2 x=133.1 y=265.3 w=27.6 h=10.7 score=0.654 tilt=- crop=1 ink=true read=/0.0 glyphs=x=169 30x28 ar=0.93 holes=0 best=8:0.90 L=W:0.86 D=8:0.90 D2=0.89
- box=3 x=94.9 y=326.7 w=7.1 h=22.2 score=0.651 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=94.9 y=326.7 w=7.1 h=22.2 score=0.651 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=225.3 w=35.6 h=9.8 score=0.521 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=86.0 y=225.3 w=35.6 h=9.8 score=0.521 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=350.0 y=292.9 w=44.4 h=9.8 score=0.442 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=350.0 y=292.9 w=44.4 h=9.8 score=0.442 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=86.0 y=264.4 w=45.3 h=10.7 score=0.440 tilt=- crop=0 ink=true read=/0.0 glyphs=x=165 17x20 ar=1.18 holes=0 best=0:0.92 L=W:0.88 D=0:0.92 D2=0.92
- box=6 x=86.0 y=264.4 w=45.3 h=10.7 score=0.440 tilt=- crop=1 ink=true read=/0.0 glyphs=x=247 17x20 ar=1.18 holes=0 best=8:0.93 L=W:0.87 D=8:0.93 D2=0.90
- box=7 x=162.4 y=266.2 w=48.0 h=12.4 score=0.409 tilt=- crop=0 ink=true read=/0.0 glyphs=x=158 19x18 ar=0.95 holes=0 best=0:0.91 L=E:0.86 D=0:0.91 D2=0.91
- box=7 x=162.4 y=266.2 w=48.0 h=12.4 score=0.409 tilt=- crop=1 ink=true read=/0.0 glyphs=x=228 19x18 ar=0.95 holes=0 best=8:0.91 L=W:0.88 D=8:0.91 D2=0.91
### pixel-live-20260617-090351__frame-310 esperado=CUW4
- box=0 x=86.0 y=330.2 w=142.2 h=40.9 score=0.746 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=86.0 y=330.2 w=142.2 h=40.9 score=0.746 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-314 esperado=CUW4
- box=0 x=195.3 y=260.9 w=87.1 h=35.6 score=0.944 tilt=-6.0 crop=0 ink=true read=ZE/0.0 glyphs=x=144 22x42 ar=1.91 holes=0 best=3:0.64 L=Z:0.60 D=3:0.64 D2=0.61 | x=176 9x4 ar=0.44 holes=0 best=E:0.39 L=E:0.39 D=0:0.35 D2=0.33
- box=0 x=195.3 y=260.9 w=87.1 h=35.6 score=0.944 tilt=-6.0 crop=1 ink=true read=N X/0.0 glyphs=x=236 9x4 ar=0.44 holes=0 best=N:0.40 L=N:0.40 D=0:0.36 D2=0.35 | x=255 22x42 ar=1.91 holes=0 best=5:0.61 L=E:0.61 D=5:0.61 D2=0.59
- box=1 x=105.6 y=260.0 w=29.3 h=10.7 score=0.737 tilt=- crop=0 ink=true read=XX/0.0 glyphs=x=119 13x29 ar=2.23 holes=0 best=4:0.87 L=M:0.79 D=4:0.87 D2=0.85 | x=132 40x37 ar=0.93 holes=0 best=0:0.92 L=E:0.85 D=0:0.92 D2=0.91
- box=1 x=105.6 y=260.0 w=29.3 h=10.7 score=0.737 tilt=- crop=1 ink=true read=OM/87.8 glyphs=x=287 42x37 ar=0.88 holes=0 best=0:0.92 L=N:0.87 D=0:0.92 D2=0.89 | x=329 11x28 ar=2.55 holes=0 best=M:0.84 L=M:0.84 D=1:0.78 D2=0.71
- box=2 x=257.6 y=301.8 w=23.1 h=69.3 score=0.611 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=257.6 y=301.8 w=23.1 h=69.3 score=0.611 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=286.7 w=174.2 h=84.4 score=0.449 tilt=- crop=0 ink=false read=/0.0 glyphs=x=181 5x3 ar=0.60 holes=0 best=E:0.26 L=E:0.26 D=9:0.24 D2=0.23
- box=3 x=86.0 y=286.7 w=174.2 h=84.4 score=0.449 tilt=- crop=1 ink=false read=/0.0 glyphs=x=83 5x3 ar=0.60 holes=0 best=E:0.27 L=E:0.27 D=4:0.21 D2=0.20
### pixel-live-20260617-090351__frame-318 esperado=POR10
- box=0 x=193.6 y=244.9 w=79.1 h=37.3 score=0.849 tilt=8.2 crop=0 ink=true read=EN XX/0.0 glyphs=x=132 41x47 ar=1.15 holes=1 best=E:0.69 L=E:0.69 D=8:0.66 D2=0.64 | x=173 47x46 ar=0.98 holes=1 best=N:0.83 L=N:0.83 D=0:0.79 D2=0.76 | x=239 28x50 ar=1.79 holes=0 best=1:0.95 L=I:0.87 D=1:0.95 D2=0.86 | x=267 48x53 ar=1.10 holes=1 best=0:0.94 L=Q:0.89 D=0:0.94 D2=0.94
- box=0 x=193.6 y=244.9 w=79.1 h=37.3 score=0.849 tilt=8.2 crop=1 ink=true read=OTE X/0.0 glyphs=x=145 47x53 ar=1.13 holes=1 best=0:0.92 L=O:0.92 D=0:0.92 D2=0.91 | x=192 29x50 ar=1.72 holes=0 best=T:0.91 L=T:0.91 D=1:0.87 D2=0.78 | x=240 46x46 ar=1.00 holes=1 best=E:0.79 L=E:0.79 D=8:0.76 D2=0.75 | x=286 42x47 ar=1.12 holes=1 best=M:0.68 L=M:0.68 D=0:0.67 D2=0.66
- box=1 x=215.8 y=279.6 w=41.8 h=11.6 score=0.764 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=215.8 y=279.6 w=41.8 h=11.6 score=0.764 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=97.6 y=258.2 w=90.7 h=33.8 score=0.748 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=97.6 y=258.2 w=90.7 h=33.8 score=0.748 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=207.8 y=261.8 w=23.1 h=12.4 score=0.724 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=207.8 y=261.8 w=23.1 h=12.4 score=0.724 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=251.3 y=283.1 w=22.2 h=48.0 score=0.702 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=251.3 y=283.1 w=22.2 h=48.0 score=0.702 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=262.9 y=330.2 w=10.7 h=40.9 score=0.495 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=262.9 y=330.2 w=10.7 h=40.9 score=0.495 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-319 esperado=POR10
- box=0 x=200.7 y=241.3 w=82.7 h=37.3 score=0.869 tilt=7.1 crop=0 ink=true read=EN XX/0.0 glyphs=x=109 37x41 ar=1.11 holes=1 best=E:0.72 L=E:0.72 D=0:0.69 D2=0.67 | x=146 39x43 ar=1.10 holes=1 best=N:0.82 L=N:0.82 D=0:0.78 D2=0.76 | x=205 23x44 ar=1.91 holes=0 best=1:0.95 L=G:0.88 D=1:0.95 D2=0.77 | x=231 36x46 ar=1.28 holes=1 best=O:0.95 L=O:0.95 D=0:0.92 D2=0.92
- box=0 x=200.7 y=241.3 w=82.7 h=37.3 score=0.869 tilt=7.1 crop=1 ink=true read=OTEM/84.9 glyphs=x=120 36x46 ar=1.28 holes=1 best=0:0.94 L=O:0.93 D=0:0.94 D2=0.91 | x=159 23x44 ar=1.91 holes=0 best=T:0.91 L=T:0.91 D=1:0.89 D2=0.75 | x=202 38x43 ar=1.13 holes=1 best=E:0.79 L=E:0.79 D=8:0.77 D2=0.75 | x=240 38x41 ar=1.08 holes=1 best=M:0.75 L=M:0.75 D=0:0.69 D2=0.65
- box=1 x=98.4 y=253.8 w=96.0 h=37.3 score=0.782 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=98.4 y=253.8 w=96.0 h=37.3 score=0.782 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=214.9 y=258.2 w=24.0 h=12.4 score=0.722 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=214.9 y=258.2 w=24.0 h=12.4 score=0.722 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=118.9 y=269.8 w=24.0 h=9.8 score=0.680 tilt=- crop=0 ink=false read=/0.0 glyphs=x=152 13x27 ar=2.08 holes=0 best=M:0.85 L=M:0.85 D=4:0.79 D2=0.79
- box=3 x=118.9 y=269.8 w=24.0 h=9.8 score=0.680 tilt=- crop=1 ink=false read=/0.0 glyphs=x=244 13x27 ar=2.08 holes=0 best=M:0.88 L=M:0.88 D=4:0.82 D2=0.81
- box=4 x=261.1 y=280.4 w=21.3 h=90.7 score=0.525 tilt=- crop=0 ink=false read=/0.0 glyphs=x=135 2x3 ar=1.50 holes=0 best=T:0.24 L=T:0.24 D=4:0.21 D2=0.20
- box=4 x=261.1 y=280.4 w=21.3 h=90.7 score=0.525 tilt=- crop=1 ink=false read=/0.0 glyphs=x=292 2x3 ar=1.50 holes=0 best=T:0.24 L=T:0.24 D=4:0.21 D2=0.20
### pixel-live-20260617-090351__frame-320 esperado=POR10
- box=0 x=167.8 y=287.6 w=20.4 h=8.0 score=0.763 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=167.8 y=287.6 w=20.4 h=8.0 score=0.763 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=95.8 y=283.1 w=26.7 h=9.8 score=0.704 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=1 x=95.8 y=283.1 w=26.7 h=9.8 score=0.704 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=2 x=232.7 y=276.0 w=64.0 h=32.9 score=0.659 tilt=- crop=0 ink=false read=E X/0.0 glyphs=x=116 4x4 ar=1.00 holes=0 best=E:0.23 L=E:0.23 D=9:0.21 D2=0.21 | x=127 2x4 ar=2.00 holes=0 best=1:0.29 L=I:0.27 D=1:0.29 D2=0.27
- box=2 x=232.7 y=276.0 w=64.0 h=32.9 score=0.659 tilt=- crop=1 ink=false read=FE/0.0 glyphs=x=91 2x4 ar=2.00 holes=0 best=F:0.26 L=F:0.26 D=8:0.24 D2=0.22 | x=100 4x4 ar=1.00 holes=0 best=E:0.24 L=E:0.24 D=9:0.23 D2=0.21
- box=3 x=86.0 y=252.9 w=32.9 h=10.7 score=0.485 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=3 x=86.0 y=252.9 w=32.9 h=10.7 score=0.485 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=4 x=124.2 y=284.9 w=41.8 h=9.8 score=0.421 tilt=- crop=0 ink=true read=F X/0.0 glyphs=x=252 2x4 ar=2.00 holes=0 best=F:0.26 L=F:0.26 D=8:0.24 D2=0.22 | x=327 2x6 ar=3.00 holes=0 best=1:0.34 L=I:0.34 D=1:0.34 D2=0.30
- box=4 x=124.2 y=284.9 w=41.8 h=9.8 score=0.421 tilt=- crop=1 ink=true read=F X/0.0 glyphs=x=94 2x6 ar=3.00 holes=0 best=F:0.34 L=F:0.34 D=8:0.29 D2=0.28 | x=169 2x4 ar=2.00 holes=0 best=4:0.28 L=I:0.27 D=4:0.28 D2=0.25
### pixel-live-20260617-090351__frame-321 esperado=POR10
- box=0 x=89.6 y=256.4 w=29.3 h=8.0 score=0.752 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=89.6 y=256.4 w=29.3 h=8.0 score=0.752 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=102.9 y=264.4 w=56.0 h=21.3 score=0.720 tilt=- crop=0 ink=false read=E X/0.0 glyphs=x=106 9x5 ar=0.56 holes=0 best=E:0.39 L=E:0.39 D=0:0.37 D2=0.34 | x=183 8x8 ar=1.00 holes=0 best=0:0.49 L=S:0.44 D=0:0.49 D2=0.49
- box=1 x=102.9 y=264.4 w=56.0 h=21.3 score=0.720 tilt=- crop=1 ink=false read=BH/0.0 glyphs=x=87 8x8 ar=1.00 holes=0 best=8:0.47 L=E:0.44 D=8:0.47 D2=0.46 | x=163 9x5 ar=0.56 holes=0 best=H:0.42 L=H:0.42 D=0:0.37 D2=0.36
- box=2 x=235.3 y=273.3 w=63.1 h=32.0 score=0.663 tilt=- crop=0 ink=false read=OE/0.0 glyphs=x=118 5x4 ar=0.80 holes=0 best=0:0.31 L=I:0.30 D=0:0.31 D2=0.29 | x=130 2x5 ar=2.50 holes=0 best=E:0.29 L=E:0.29 D=8:0.26 D2=0.26
- box=2 x=235.3 y=273.3 w=63.1 h=32.0 score=0.663 tilt=- crop=1 ink=false read=IP/0.0 glyphs=x=88 2x5 ar=2.50 holes=0 best=I:0.34 L=I:0.34 D=1:0.30 D2=0.29 | x=97 5x4 ar=0.80 holes=0 best=P:0.32 L=P:0.32 D=2:0.27 D2=0.27
- box=3 x=131.3 y=277.8 w=40.0 h=10.7 score=0.404 tilt=- crop=0 ink=true read=/0.0 glyphs=x=144 19x20 ar=1.05 holes=0 best=W:0.91 L=W:0.91 D=8:0.91 D2=0.91
- box=3 x=131.3 y=277.8 w=40.0 h=10.7 score=0.404 tilt=- crop=1 ink=true read=/0.0 glyphs=x=221 19x20 ar=1.05 holes=0 best=8:0.93 L=W:0.87 D=8:0.93 D2=0.91
### pixel-live-20260617-090351__frame-323 esperado=IRQ20
- box=0 x=122.4 y=274.2 w=26.7 h=8.0 score=0.807 tilt=2.0 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=122.4 y=274.2 w=26.7 h=8.0 score=0.807 tilt=2.0 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=173.1 y=263.6 w=40.0 h=17.8 score=0.778 tilt=- crop=0 ink=false read=/0.0 glyphs=x=151 17x17 ar=1.00 holes=0 best=0:0.92 L=E:0.86 D=0:0.92 D2=0.89
- box=1 x=173.1 y=263.6 w=40.0 h=17.8 score=0.778 tilt=- crop=1 ink=false read=/0.0 glyphs=x=216 17x17 ar=1.00 holes=0 best=0:0.92 L=M:0.85 D=0:0.92 D2=0.90
- box=2 x=91.3 y=275.1 w=20.4 h=8.0 score=0.733 tilt=- crop=0 ink=false read=/0.0 glyphs=x=279 12x16 ar=1.33 holes=0 best=8:0.82 L=W:0.80 D=8:0.82 D2=0.80
- box=2 x=91.3 y=275.1 w=20.4 h=8.0 score=0.733 tilt=- crop=1 ink=false read=/0.0 glyphs=x=148 12x16 ar=1.33 holes=0 best=4:0.87 L=W:0.82 D=4:0.87 D2=0.82
- box=3 x=222.9 y=262.7 w=82.7 h=26.7 score=0.698 tilt=- crop=0 ink=true read=WO 20/88.8 glyphs=x=96 20x28 ar=1.40 holes=1 best=W:0.78 L=W:0.78 D=5:0.78 D2=0.76 | x=116 37x35 ar=0.95 holes=1 best=0:0.80 L=E:0.80 D=0:0.80 D2=0.78 | x=168 27x37 ar=1.37 holes=0 best=2:0.98 L=B:0.82 D=2:0.98 D2=0.86 | x=195 34x37 ar=1.09 holes=2 best=0:0.99 L=E:0.88 D=0:0.99 D2=0.94
- box=3 x=222.9 y=262.7 w=82.7 h=26.7 score=0.698 tilt=- crop=1 ink=true read=OBSN X/0.0 glyphs=x=96 32x37 ar=1.16 holes=2 best=0:0.97 L=O:0.88 D=0:0.97 D2=0.96 | x=128 29x37 ar=1.28 holes=0 best=8:0.87 L=B:0.83 D=8:0.87 D2=0.85 | x=172 13x35 ar=2.69 holes=0 best=S:0.85 L=S:0.85 D=1:0.75 D2=0.67 | x=185 35x34 ar=0.97 holes=1 best=N:0.85 L=N:0.85 D=0:0.83 D2=0.79 | x=220 9x21 ar=2.33 holes=0 best=1:0.82 L=I:0.78 D=1:0.82 D2=0.80
- box=4 x=150.0 y=272.4 w=22.2 h=9.8 score=0.630 tilt=- crop=0 ink=true read=/0.0 glyphs=x=68 25x23 ar=0.92 holes=0 best=0:0.94 L=W:0.87 D=0:0.94 D2=0.91
- box=4 x=150.0 y=272.4 w=22.2 h=9.8 score=0.630 tilt=- crop=1 ink=true read=/0.0 glyphs=x=152 25x23 ar=0.92 holes=0 best=0:0.92 L=W:0.87 D=0:0.92 D2=0.91
- box=5 x=86.0 y=340.9 w=7.1 h=30.2 score=0.580 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=5 x=86.0 y=340.9 w=7.1 h=30.2 score=0.580 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=6 x=351.8 y=295.6 w=42.7 h=10.7 score=0.499 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=6 x=351.8 y=295.6 w=42.7 h=10.7 score=0.499 tilt=- crop=1 ink=false read=/0.0 glyphs=
### pixel-live-20260617-090351__frame-325 esperado=IRQ20
- box=0 x=127.8 y=347.1 w=15.1 h=24.0 score=0.837 tilt=87.2 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=127.8 y=347.1 w=15.1 h=24.0 score=0.837 tilt=87.2 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=222.0 y=278.7 w=75.6 h=31.1 score=0.763 tilt=- crop=0 ink=true read=R 28/87.7 glyphs=x=78 42x34 ar=0.81 holes=2 best=R:0.77 L=R:0.77 D=0:0.72 D2=0.67 | x=130 22x34 ar=1.55 holes=0 best=2:0.93 L=Z:0.80 D=2:0.93 D2=0.86 | x=152 28x36 ar=1.29 holes=2 best=8:0.93 L=E:0.90 D=8:0.93 D2=0.92
- box=1 x=222.0 y=278.7 w=75.6 h=31.1 score=0.763 tilt=- crop=1 ink=true read=BBN/86.1 glyphs=x=82 27x36 ar=1.33 holes=2 best=8:0.94 L=W:0.92 D=8:0.94 D2=0.92 | x=109 23x34 ar=1.48 holes=0 best=8:0.86 L=B:0.86 D=8:0.86 D2=0.84 | x=142 42x34 ar=0.81 holes=2 best=N:0.78 L=N:0.78 D=0:0.72 D2=0.68
- box=2 x=320.7 y=345.3 w=9.8 h=25.8 score=0.650 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=2 x=320.7 y=345.3 w=9.8 h=25.8 score=0.650 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=3 x=185.6 y=292.9 w=28.4 h=9.8 score=0.638 tilt=- crop=0 ink=true read=/0.0 glyphs=x=111 16x17 ar=1.06 holes=0 best=0:0.93 L=E:0.87 D=0:0.93 D2=0.92
- box=3 x=185.6 y=292.9 w=28.4 h=9.8 score=0.638 tilt=- crop=1 ink=true read=/0.0 glyphs=x=172 16x17 ar=1.06 holes=0 best=0:0.92 L=W:0.88 D=0:0.92 D2=0.92
- box=4 x=279.8 y=258.2 w=41.8 h=22.2 score=0.618 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=4 x=279.8 y=258.2 w=41.8 h=22.2 score=0.618 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=5 x=144.7 y=294.7 w=39.1 h=9.8 score=0.427 tilt=- crop=0 ink=true read=XX/0.0 glyphs=x=118 11x12 ar=1.09 holes=0 best=8:0.64 L=E:0.64 D=8:0.64 D2=0.62 | x=252 13x18 ar=1.38 holes=0 best=0:0.87 L=W:0.85 D=0:0.87 D2=0.86
- box=5 x=144.7 y=294.7 w=39.1 h=9.8 score=0.427 tilt=- crop=1 ink=true read=XX/0.0 glyphs=x=137 13x18 ar=1.38 holes=0 best=8:0.86 L=M:0.85 D=8:0.86 D2=0.85 | x=273 11x12 ar=1.09 holes=0 best=E:0.65 L=E:0.65 D=0:0.65 D2=0.65
### pixel-live-20260617-090351__frame-328 esperado=IRQ20
- box=0 x=93.1 y=320.4 w=106.7 h=50.7 score=0.794 tilt=- crop=0 ink=false read=/0.0 glyphs=
- box=0 x=93.1 y=320.4 w=106.7 h=50.7 score=0.794 tilt=- crop=1 ink=false read=/0.0 glyphs=
- box=1 x=189.1 y=262.7 w=84.4 h=30.2 score=0.788 tilt=- crop=0 ink=true read=BO 28/89.6 glyphs=x=95 20x34 ar=1.70 holes=0 best=8:0.87 L=M:0.86 D=8:0.87 D2=0.86 | x=115 34x36 ar=1.06 holes=1 best=0:0.83 L=E:0.82 D=0:0.83 D2=0.80 | x=162 22x35 ar=1.59 holes=0 best=2:0.95 L=B:0.83 D=2:0.95 D2=0.86 | x=184 28x35 ar=1.25 holes=2 best=8:0.93 L=E:0.90 D=8:0.93 D2=0.93
- box=1 x=189.1 y=262.7 w=84.4 h=30.2 score=0.788 tilt=- crop=1 ink=true read=BBS X/0.0 glyphs=x=83 27x35 ar=1.30 holes=2 best=8:0.95 L=O:0.90 D=8:0.95 D2=0.93 | x=110 23x35 ar=1.52 holes=0 best=B:0.86 L=B:0.86 D=8:0.86 D2=0.84 | x=146 13x36 ar=2.77 holes=0 best=S:0.83 L=S:0.83 D=1:0.73 D2=0.66 | x=159 41x35 ar=0.85 holes=1 best=0:0.88 L=M:0.87 D=0:0.88 D2=0.85
- box=2 x=89.6 y=270.7 w=32.9 h=11.6 score=0.783 tilt=- crop=0 ink=true read=/0.0 glyphs=
- box=2 x=89.6 y=270.7 w=32.9 h=11.6 score=0.783 tilt=- crop=1 ink=true read=/0.0 glyphs=
- box=3 x=126.0 y=271.6 w=51.6 h=10.7 score=0.423 tilt=- crop=0 ink=true read=/0.0 glyphs=x=186 28x25 ar=0.89 holes=0 best=8:0.92 L=W:0.89 D=8:0.92 D2=0.92
- box=3 x=126.0 y=271.6 w=51.6 h=10.7 score=0.423 tilt=- crop=1 ink=true read=/0.0 glyphs=x=272 28x25 ar=0.89 holes=0 best=8:0.92 L=W:0.87 D=8:0.92 D2=0.92
### pixel-live-20260617-090351__frame-330 esperado=IRQ20
- box=0 x=99.3 y=321.3 w=104.0 h=49.8 score=0.891 tilt=-6.8 crop=0 ink=false read=/0.0 glyphs=
- box=0 x=99.3 y=321.3 w=104.0 h=49.8 score=0.891 tilt=-6.8 crop=1 ink=false read=/0.0 glyphs=
- box=1 x=97.6 y=272.4 w=31.1 h=11.6 score=0.867 tilt=1.7 crop=0 ink=true read=/0.0 glyphs=
- box=1 x=97.6 y=272.4 w=31.1 h=11.6 score=0.867 tilt=1.7 crop=1 ink=true read=/0.0 glyphs=
- box=2 x=195.3 y=266.2 w=80.9 h=27.6 score=0.589 tilt=- crop=0 ink=true read=BE XX/0.0 glyphs=x=99 19x23 ar=1.21 holes=0 best=8:0.79 L=W:0.78 D=8:0.79 D2=0.76 | x=118 39x39 ar=1.00 holes=1 best=E:0.79 L=E:0.79 D=0:0.79 D2=0.75 | x=171 26x38 ar=1.46 holes=0 best=2:0.97 L=W:0.83 D=2:0.97 D2=0.87 | x=197 30x39 ar=1.30 holes=1 best=8:0.93 L=B:0.89 D=8:0.93 D2=0.92
- box=2 x=195.3 y=266.2 w=80.9 h=27.6 score=0.589 tilt=- crop=1 ink=true read=BB XX/0.0 glyphs=x=85 29x39 ar=1.34 holes=1 best=8:0.93 L=W:0.91 D=8:0.93 D2=0.92 | x=114 27x38 ar=1.41 holes=0 best=8:0.88 L=W:0.86 D=8:0.88 D2=0.86 | x=155 38x39 ar=1.03 holes=1 best=0:0.77 L=B:0.76 D=0:0.77 D2=0.76 | x=193 20x23 ar=1.15 holes=0 best=M:0.83 L=M:0.83 D=5:0.79 D2=0.78