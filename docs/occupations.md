# 직업 콘텐츠 규격

552개 전체를 공통 데이터로 수용한다. 번호와 원래 직업명은 유지하고 실제 작업이 같은 항목은 canonicalId로 연결한다. 회사별 차이는 variant로 관리한다.

## 직무 필드
- id, originalIndex, name, canonicalId, aliases
- tasks, environment, entryRoutes, employers
- sources: url, publisher, collectedAt, verifiedAt, kind, scope
- researchStatus: unreviewed / partial / verified
- gameplayStatus: not_started / draft / playable

조사 상태 verified는 필요한 주장과 출처를 대조했을 때만 지정한다. CareerNet 원문을 가져왔다는 이유로 회사별 최신 모집까지 확인한 것으로 세지 않는다. 출처 없는 항목은 빈 값과 미확보 사유를 보존한다. 조사 중인 통합문서는 별도 유지하고 검토된 자료를 이 형식으로 가져온다.

## 시나리오 필드
직무 ID, 배경·사업장 변형, 준비 조건, 등장인물 역할, 업무 단계, 플레이어가 할 수 있는 행동, 규칙으로 판정할 성공·실패 조건, 소요 시간, 결과와 다음 기회, 고증 근거.

NPC·사건은 직업명 문자열에 직접 분기하지 않고 직무 ID와 행동 ID를 참조한다. 직무 데이터 552개가 존재해도 플레이 가능한 시나리오 552개가 완성된 것은 아니다.
