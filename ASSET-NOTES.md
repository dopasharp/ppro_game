# 이미지 작업 기록

내장 image_gen 편집 도구로 사용자 제공 이미지 1, 3, 4의 배경을 투명 처리했습니다. 이미지 2는 곰과 빼빼로의 연결 모양 참고용입니다. 이미지 4의 분홍 곰이 오른쪽 플레이어입니다.

프롬프트 원칙: 배경만 제거하고 곰의 정체성, 색, 포즈 및 4열 2행 배치를 그대로 유지. 빼빼로 5종의 무늬와 순서를 유지하고 흰 배경만 제거. 실제 알파 채널 PNG 출력.

Cream prompt:
Edit target: attached cream bear sprite sheet. BACKGROUND EXTRACTION ONLY. Remove every gray checkerboard/background pixel and replace with true transparent alpha. Preserve exactly the 8 cream bear sprites, pink bows, their 4 columns by 2 rows grid, their positions and sizes, image 1536x1024 dimensions. First row four closed mouth walk frames, second row four open mouth walk/eat frames. Do not redraw or change bears, don't add checkerboard, shadows, objects, labels, or rearrange. Output transparent PNG sprite sheet with original 4x2 layout. Keep all eight complete sprites separated.

Pink prompt:
Edit target: attached pink bear sprite sheet. BACKGROUND EXTRACTION ONLY. Remove every gray checkerboard/background pixel and replace with true transparent alpha. Preserve exactly the 8 pink bear sprites, lavender hats and bows, their 4 columns by 2 rows grid, their positions and sizes, image 1536x1024 dimensions. First row four closed mouth walk frames, second row four open mouth walk/eat frames. Do not redraw or change bears, don't add checkerboard, shadows, objects, labels, or rearrange. Output transparent PNG sprite sheet with original 4x2 layout. Keep all eight complete sprites separated.

Pepero prompt:
Edit target: attached 5 decorated pepero biscuit sticks in five horizontal rows. BACKGROUND EXTRACTION ONLY. Remove white background and make real transparent alpha. Preserve all five exact sticks and decorations, their horizontal layout and positions. No new objects, labels, no checkerboard, do not redraw/recolor. Five separate full-length sticks from top to bottom chocolate pink hearts, strawberry, purple, almond, plain chocolate. Output wide transparent PNG atlas with all five original horizontal rows and original 3:1 aspect ratio.
