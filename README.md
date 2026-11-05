# 어른왕자

> 오늘이 가장 젊은 날, 어떤 삶을 살아볼래?

직업과 관계, 공부와 생활을 경험하며 자기 삶의 이야기를 만드는 PC 웹 인생 시뮬레이션.

## 현재 상태
해솔동 골목을 걷고 민서와 체험 약속을 잡아 교육장에서 상태표를 확인하는 첫 체험이 PC 브라우저에서 실행됩니다.

- [기획 기준](docs/product.md)
- [첫 플레이 범위](docs/first-play.md)
- [구조와 상태 규칙](docs/architecture.md)
- [직업 콘텐츠 규격](docs/occupations.md)
- [개발 순서와 미정 사항](docs/roadmap.md)
- [결정 기록](docs/decisions.md)

## 실행

Node.js 22 이상에서 다음 명령을 실행하고 브라우저로 [첫 체험](http://127.0.0.1:4173/)을 엽니다.

```sh
node scripts/play-first-web.mjs
```

`WASD`로 걷고 방향키나 화면 드래그로 둘러봅니다. 인물이나 사물에 가까이 가서 `E`를 누르면 상호작용합니다. `P`로 휴대폰 달력을 열어 확정 일정과 저장 메뉴를 확인할 수 있습니다. 저장은 현재 브라우저에 남습니다.

민서의 자유 대화에 Ollama를 사용하려면 PowerShell에서 설치된 로컬 모델을 지정해 시작합니다. 모델 연결이 끊기면 기본 대사가 나옵니다.

```powershell
$env:ADULT_PRINCE_MODEL = 'qwen3:4b-instruct-2507-q4_K_M'
node scripts/play-first-web.mjs
```

공통 엔진의 검증은 다음 명령으로 실행합니다.

```sh
npm test
```

`packages/simulation`은 시간, 약속, 관계, NPC 지식과 행동 기억을 다룹니다. 직업 552개의 조사 완료와 플레이 가능한 콘텐츠 제작 완료는 별도 상태로 관리합니다.

## AI 품질 개발
[평가 방법과 한계](docs/ai-quality.md). `npm run eval:prepare`로 모델 없이 입력을 확인한다. 첫 체험에서는 자유 대화와 예약·체험을 진행하는 게임 행동을 별도로 처리한다.
