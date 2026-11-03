# 어른왕자

> 오늘이 가장 젊은 날, 어떤 삶을 살아볼래?

직업과 관계, 공부와 생활을 경험하며 자기 삶의 이야기를 만드는 PC 웹 인생 시뮬레이션.

## 현재 상태
새 프로젝트의 문서와 게임 상태 엔진을 준비한 단계입니다. 1인칭 화면과 AI 연결은 아직 구현되지 않았습니다.

- [기획 기준](docs/product.md)
- [첫 플레이 범위](docs/first-play.md)
- [구조와 상태 규칙](docs/architecture.md)
- [직업 콘텐츠 규격](docs/occupations.md)
- [개발 순서와 미정 사항](docs/roadmap.md)
- [결정 기록](docs/decisions.md)

## 실행
Node.js 22 이상에서 외부 설치 없이 공통 엔진의 검증을 실행합니다.

```sh
npm test
```

`packages/simulation`은 시간, 약속, 관계, NPC 지식과 행동 기억을 다룹니다. 직업 552개의 조사 완료와 플레이 가능한 콘텐츠 제작 완료는 별도 상태로 관리합니다.

## AI 품질 개발
[평가 방법과 한계](docs/ai-quality.md). `npm run eval:prepare`로 모델 없이 입력을 확인한다. 실제 모델 연결과 대화 품질 검증은 아직 미완료다.
